import React, { useEffect, useState } from 'react';
import useFieldApi, {
  UseFieldApiProps,
} from '@data-driven-forms/react-form-renderer/use-field-api';
import { AssociateEventTypesStep } from '../../../Notifications/BehaviorGroupWizard/Steps/AssociateEventTypesStep';
import { EventType, Facet } from '../../../../types/Notification';
import useFormApi from '@data-driven-forms/react-form-renderer/use-form-api';
import FormSpy from '@data-driven-forms/react-form-renderer/form-spy';
import { getBundleFacets } from '../../../../api/helpers/notifications/bundle-facets-helper';
import {
  Bullseye,
  EmptyState,
  EmptyStateBody,
  EmptyStateHeader,
  EmptyStateIcon,
} from '@patternfly/react-core';
import CubesIcon from '@patternfly/react-icons/dist/dynamic/icons/cube-icon';
import { UserIntegration } from '../../../../types/Integration';
import { getEntpoint } from '../../../../api/helpers/integrations/endpoints-helper';

export interface TableRow {
  id: string;
  [key: string]: unknown;
}

function isEvent(data: unknown): data is Record<string, EventType> {
  return Object.values(data || {}).every((event) =>
    Object.prototype.hasOwnProperty.call(event, 'id')
  );
}

function isEventReadonly(
  data: Record<string, unknown>
): data is Record<string, Record<string, EventType>> {
  return Object.values(data).every(
    (item) =>
      isEvent(item) &&
      Object.values(item).every((event) =>
        Object.prototype.hasOwnProperty.call(event, 'id')
      )
  );
}

export interface SelectableTableProps<T extends TableRow>
  extends UseFieldApiProps<T[]> {
  name: string;
  data?: ReadonlyArray<T>;
  columns: { name: string; key: string }[];
  onSelect?: (isSelected: boolean, row: T) => void;
  selectionLoading?: boolean;
  skeletonRows?: number;
}

const SelectableTable = (props) => {
  const [allBundles, setAllBundles] = useState<Facet[] | undefined>();
  const { getState } = useFormApi();
  const { input } = useFieldApi<Record<string, unknown>>(props);
  let value: readonly EventType[] = [];
  const productFamily = getState().values[props.bundleFieldName];
  const integrationId = getState().values['id'];

  useEffect(() => {
    const getAllBundles = async () => {
      const bundles: Facet[] = await getBundleFacets({
        includeApplications: true,
      });
      setAllBundles(bundles);
    };
    getAllBundles();
  }, []);

  const currBundle = allBundles?.find(({ name }) => name === productFamily);

  if (currBundle?.displayName && isEventReadonly(input.value)) {
    value = Object.values(
      input.value?.[currBundle?.displayName] || {}
    ) as readonly EventType[];
  }

  const mapEventTypesToInput = (events: any) => {
    let newInput = {
      'OpenShift': {},
      'Red Hat Enterprise Linux': {},
      'Console': {},
    };
    events.forEach((event) => {
      newInput[event.bundle.display_name] = {
        ...newInput[event.bundle.display_name],
        [event.id]: {
          eventTypeDisplayName: event.display_name,
          applicationDisplayName: event.application.display_name,
          description: event.description,
          id: event.id,
          isSelected: true,
        },
      };
    });
    return newInput;
  }

  React.useEffect(() => {
    if (integrationId) {
      console.log('this is integrationId', integrationId);
      const getEventData = async () => {
        const data = await getEntpoint(integrationId);
        if (data.event_types_group_by_bundles_and_applications) {
          const eventTypes = data.event_types_group_by_bundles_and_applications
            .flatMap(({ applications, ...bundle }) =>
              applications.map(({ event_types, ...application }) =>
                event_types.map((event) => ({ ...event, application, bundle }))
              )
            )
            .flat();
          input.onChange(mapEventTypesToInput(eventTypes));
        }
      };

      getEventData();
    }
  }, [integrationId]);

  return currBundle ? (
    <AssociateEventTypesStep
      applications={currBundle.children as readonly Facet[]}
      bundle={currBundle}
      setValues={(events) => {
        input.onChange({
          ...input.value,
          [currBundle?.displayName]: {
            ...events,
          },
        });
      }}
      // initialEventTypes={activeIntegration?.eventTypes}
      values={{ events: value }}
    />
  ) : (
    <Bullseye>
      <EmptyState>
        <EmptyStateHeader
          titleText="Select product family"
          headingLevel="h4"
          icon={<EmptyStateIcon icon={CubesIcon} />}
        />
        <EmptyStateBody>
          Before you can assign events to integration you have to select from
          which bundle events should be assignable.
        </EmptyStateBody>
      </EmptyState>
    </Bullseye>
  );
};

const SelectableTableWrapper = (props) => (
  <FormSpy subscription={{ values: true }}>
    {() => <SelectableTable {...props} />}
  </FormSpy>
);

export default SelectableTableWrapper;
