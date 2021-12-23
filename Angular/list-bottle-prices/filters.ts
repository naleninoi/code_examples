import {
  FilteredTableFilterConfig,
  FilteredTableFilterType
} from '../../../../modules/ui/components/lists/filtered-table/filtered-table.interfaces';
import {AppStateService} from '../../../../modules/ecosystem/services/app-state.service';
import {map} from 'rxjs/operators';

export function componentFilters(context): Array<FilteredTableFilterConfig> {
  return [
    {
      name: 'bottleTypeId',
      title: 'Тип баллона',
      type: FilteredTableFilterType.select,
      defaultValue: -1,
      numericalValue: true,
      options: context.bottleTypesService.bottleTypesFilters
    },
    {
      name: 'officeId',
      title: 'Офис',
      type: FilteredTableFilterType.select,
      defaultValue: -1,
      numericalValue: true,
      options: context.officesService.officesFilters,
      hidden: (context.appState as AppStateService).profile.pipe(
        map( p => !p?.isSuper ),
      ),
    },
    {
      name: 'showUnavailable',
      title: 'Показать отключенные',
      type: FilteredTableFilterType.slideToggle,
      defaultValue: false,
    },
  ];
}
