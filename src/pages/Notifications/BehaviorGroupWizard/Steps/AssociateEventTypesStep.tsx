import { Text, TextContent, Title } from '@patternfly/react-core';
import { Form, Page } from '@redhat-cloud-services/insights-common-typescript';
import { useFormikContext } from 'formik';
import produce from 'immer';
import * as React from 'react';
import { useEffect } from 'react';

import { IntegrationWizardStep } from '../../../../components/Notifications/BehaviorGroup/Wizard/ExtendedWizardStep';
import {
  SelectableEventTypeRow,
  SelectableEventTypeTable,
} from '../../../../components/Notifications/BehaviorGroup/Wizard/SelectableEventTypeTable';
import {
  NotificationsToolbar,
  SelectionCommand,
} from '../../../../components/Notifications/Toolbar';
import {
  useListNotifications,
  useParameterizedListNotifications,
} from '../../../../services/useListNotifications';
import { CreateBehaviorGroup } from '../../../../types/CreateBehaviorGroup';
import { EventType, Facet } from '../../../../types/Notification';
import { useEventTypesPage } from '../../hooks/useEventTypesPage';

const title = 'Associate event types';

export interface AssociateEventTypesStepProps {
  applications: ReadonlyArray<Facet>;
  bundle: Facet;
  setValues?: (values: Record<string, EventType>) => void;
  values?: {
    events: readonly EventType[];
  };
}

export const AssociateEventTypesStep: React.FunctionComponent<
  AssociateEventTypesStepProps
> = (props) => {
  const [selectedEventTypes, setSelectedEventTypes] = React.useState<
    Record<string, EventType>
  >(() => {
    const selected: Record<string, EventType> = {};
    props.values?.events.forEach((value) => {
      selected[value.id] = value;
    });

    return selected;
  });
  const eventTypePage = useEventTypesPage(
    props.bundle,
    props.applications,
    false
  );
  const eventTypesRaw = useListNotifications(eventTypePage.pageController.page);
  const onDemandEventTypes = useParameterizedListNotifications();

  useEffect(() => {
    if (props.bundle.displayName) {
      setSelectedEventTypes(
        props.values?.events.reduce<Record<string, EventType>>((acc, curr) => {
          acc[curr.id] = curr;
          return acc;
        }, {}) || {}
      );
      eventTypesRaw.reset();
    }
  }, [props.bundle.displayName]);

  const count = React.useMemo(() => {
    const payload = eventTypesRaw.payload;
    if (payload?.status === 200) {
      return payload.value.meta.count;
    }

    return 0;
  }, [eventTypesRaw.payload]);

  const events = React.useMemo<ReadonlyArray<SelectableEventTypeRow>>(() => {
    if (eventTypesRaw.payload?.type === 'eventTypesArray') {
      return eventTypesRaw.payload.value.data.map((value) => ({
        ...value,
        isSelected: Object.keys(selectedEventTypes).includes(value.id),
      }));
    }

    return [];
  }, [eventTypesRaw.payload, selectedEventTypes]);

  useEffect(() => {
    props.setValues?.(selectedEventTypes);
  }, [selectedEventTypes]);

  const onSelect = React.useCallback(
    (isSelected: boolean, eventType: EventType) => {
      setSelectedEventTypes(
        produce((draft) => {
          if (isSelected) {
            draft[eventType.id] = eventType;
          } else {
            delete draft[eventType.id];
          }
        })
      );
    },
    [setSelectedEventTypes]
  );

  const onSelectCommand = React.useCallback(
    (command: SelectionCommand) => {
      const currentPage = eventTypePage.pageController.page;

      switch (command) {
        case SelectionCommand.ALL:
          if (count === events.length) {
            return setSelectedEventTypes(
              produce((draft) => {
                events.forEach((e) => {
                  draft[e.id] = e;
                });
              })
            );
          } else {
            (async () => {
              let pageIndex = 1;
              const addedElements: Record<string, EventType> = {};
              const lastPage = Page.lastPageForElements(
                count,
                currentPage.size
              );
              // eslint-disable-next-line no-constant-condition
              while (true) {
                const fetchingPage = currentPage.withPage(pageIndex);

                if (fetchingPage.index > lastPage.index) {
                  break;
                }

                if (currentPage.index === fetchingPage.index) {
                  events.forEach((e) => {
                    addedElements[e.id] = e;
                  });
                } else {
                  const events = await onDemandEventTypes.query(
                    currentPage.withPage(pageIndex)
                  );
                  if (events.payload?.type === 'eventTypesArray') {
                    events.payload.value.data.forEach((e) => {
                      addedElements[e.id] = e;
                    });
                  } else {
                    break;
                  }
                }

                pageIndex++;
              }

              setSelectedEventTypes(
                produce((draft) => {
                  for (const event of Object.values(addedElements)) {
                    draft[event.id] = event;
                  }
                })
              );
            })();
          }

          break;
        case SelectionCommand.PAGE:
          setSelectedEventTypes(
            produce((draft) => {
              events.forEach((e) => {
                draft[e.id] = e;
              });
            })
          );

          break;
        case SelectionCommand.NONE:
          setSelectedEventTypes({});
          break;
      }
    },
    [
      setSelectedEventTypes,
      events,
      onDemandEventTypes,
      eventTypePage.pageController.page,
      count,
    ]
  );

  return (
    <Form>
      <div>
        <Title headingLevel="h4" size="xl">
          {title}
        </Title>
        <TextContent className="pf-v5-u-pt-sm">
          <Text>
            Select event types you would like to assign this behavior group to.
          </Text>
        </TextContent>
      </div>
      <NotificationsToolbar
        filters={eventTypePage.filters}
        setFilters={eventTypePage.setFilters}
        clearFilter={eventTypePage.clearFilters}
        appFilterOptions={props.applications}
        pageAdapter={eventTypePage.pageController}
        count={count}
        pageCount={events.length}
        onSelectionChanged={onSelectCommand}
        selectedCount={Object.keys(selectedEventTypes).length}
        bulkSelectionDisabled={onDemandEventTypes.loading}
      >
        <SelectableEventTypeTable
          onSelect={onSelect}
          events={eventTypesRaw.loading ? undefined : events}
          selectionLoading={onDemandEventTypes.loading}
        />
      </NotificationsToolbar>
    </Form>
  );
};

export const useAssociateEventTypesStep: IntegrationWizardStep<
  AssociateEventTypesStepProps
> = ({ applications, bundle }: AssociateEventTypesStepProps) => {
  const { setValues, values } = useFormikContext<CreateBehaviorGroup>();
  return React.useMemo(
    () => ({
      name: title,
      component: (
        <AssociateEventTypesStep
          applications={applications}
          bundle={bundle}
          setValues={(selected) => {
            const setter = produce((draft) => {
              draft.events = Object.values(selected);
            });
            setValues(setter);
          }}
          values={values}
        />
      ),
    }),
    [applications, bundle]
  );
};
