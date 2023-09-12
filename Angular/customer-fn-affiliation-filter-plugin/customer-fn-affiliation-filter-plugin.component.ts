import {IPluginSlotItem} from "../../../infrastructure/plugin-system/interfeces/iPluginSlotItem";
import { Component, OnDestroy, Optional } from "@angular/core";
import { RevisionFilterPanelComponent } from "../../../revisions/components/revision-list/filters-panel/revision-filter-panel.component";
import {
    RevisionEventListFilterPanelComponent
} from "../../../revisions/components/events/revision-event-list/filters-panel/revision-event-list-filter-panel.component";
import { BasePluginFilterComponent } from "../../../infrastructure/sharedMembers/baseClasses/component/base-plugin-filter-component";
import { IViewState } from "../../../infrastructure/plugin-system/interfeces/iViewState";
import { Observable } from "rxjs/Observable";
import { ViewState } from "../../../infrastructure/sharedMembers/enums/view-state-enum";
import { of, Subscription } from "rxjs";
import { IPluginFilterContainer } from "../../../infrastructure/plugin-system/interfeces/plugin-filter-container.interface";
import {
    ViolationEventFilterPanelComponent
} from "../../../revisions/components/events/violation-list/filters-panel/violation-event-filter-panel.component";
import {
    PlaningListFilterPanelComponent
} from "../../../planning/components/planning-list/planning-list-filter-panel/planning-list-filter-panel.component";
import { IndicatorsFiltersComponent } from "../../../dashboard-statistics/components/indicators-filters/indicators-filters.component";
import { BaseDictionary } from "../../../infrastructure/sharedMembers/classes/baseModels/base-dictionary.model";
import {
    CacheCustomerFnAffiliationTypeWrapperService
} from "../../../contractor-management/services/cache/cache-customer-fn-affiliation-type-wrapper.service";

/**
 * Плагинный фильтр "Принадлежность заказчика к ФН". НЛМК.
 * */
@Component({
    selector: "customer-fn-affiliation-filter-plugin",
    template: `
            <!--Принадлежность заказчика к ФН-->
            <combobox-filter id="customer-fn-filter"
                             [attr.data-id]="'CustomerFnAffiliationFilter'"
                             [attr.data-descr]="'REVISIONS.REVISION_FILTER.BELONG_CUSTOMERS_FN'|translate"
                             label="{{'REVISIONS.REVISION_FILTER.BELONG_CUSTOMERS_FN'|translate}}"
                             filterName="customerFnAffiliationId"
                             filterOperation="IN"
                             bindLabel="name"
                             bindValue="id"
                             [filterValue]="component.filterContainer.customerFnAffiliationId"
                             (filterChange)="component.filterContainer.customerFnAffiliationId=$event; component.onFilterChange()"
                             (clear)="onClear(); component.onFilterChange()"
                             [itemsGetter]="customerFnAffiliationGetter">
            </combobox-filter>
        `
})
export class CustomerFnAffiliationFilterPluginComponent extends BasePluginFilterComponent implements OnDestroy, IPluginSlotItem, IViewState {

    component: IPluginFilterContainer;
    change: Observable<any>;
    viewState: ViewState;

    /** @inheritDoc */
    componentName: string = "CustomerFnAffiliationFilterPluginComponent";

    /** Подписка на событие Сбросить фильтры */
    private clearFiltersSubscription: Subscription;

    constructor(
        @Optional() private customerFnAffiliationWrapperService: CacheCustomerFnAffiliationTypeWrapperService,
        @Optional() private revisionFilterPanelComponent: RevisionFilterPanelComponent,
        @Optional() private revisionEventListFilterPanelComponent: RevisionEventListFilterPanelComponent,
        @Optional() private violationEventFilterPanelComponent: ViolationEventFilterPanelComponent,
        @Optional() private planingListFilterPanelComponent: PlaningListFilterPanelComponent,
        @Optional() private indicatorsFiltersComponent: IndicatorsFiltersComponent,
    ) {
        super();

        if (revisionFilterPanelComponent) {
            this.component = revisionFilterPanelComponent;
        }
        if (revisionEventListFilterPanelComponent) {
            this.component = revisionEventListFilterPanelComponent;
        }
        if (violationEventFilterPanelComponent) {
            this.component = violationEventFilterPanelComponent;
        }
        if (planingListFilterPanelComponent) {
            this.component = planingListFilterPanelComponent;
        }
        if (indicatorsFiltersComponent) {
            this.component = indicatorsFiltersComponent;
        }
        this.clearFiltersSubscription = this.component.clearSubject.subscribe(this.onClear.bind(this));
    }

    /** @inheritDoc */
    getData(): any {
    }

    /** @inheritDoc */
    init(): Promise<void> {
        return Promise.resolve(undefined);
    }

    /** @inheritDoc */
    loadData(entity: any) {
    }

    /** @inheritDoc */
    prefillFilters() {
    }

    /** Сброс значений фильтра. */
    onClear() {
        this.component.filterContainer.customerFnAffiliationId = [];
        this.component.onFilterChange();
    }

    /**
     * Геттер для фильтра Принадлежность заказчика к ФН.
     */
    customerFnAffiliationGetter = (): Observable<BaseDictionary[]> => {
        if (this.customerFnAffiliationWrapperService) {
            return this.customerFnAffiliationWrapperService.getDictionaryShort();
        }
        return of([]);
    }

    ngOnDestroy(): void {
        if (this.clearFiltersSubscription) {
            this.clearFiltersSubscription.unsubscribe();
        }
    }

}
