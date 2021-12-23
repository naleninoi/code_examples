import {
  FilteredTableColumnConfig
} from '../../../../modules/ui/components/lists/filtered-table/filtered-table.interfaces';
import {map} from 'rxjs/operators';

export function componentColumns(context): Array<FilteredTableColumnConfig> {
  return [
    {
      name: 'office',
      title: 'Офис',
      sortable: true,
      centerHeader: false,
      centerValue: false,
      onClick: (price ) => {
        if (price.officeId) {
          context.router.navigate([`offices/${price.officeId}`]);
        }
      },
      hidden: context.appState.profile.pipe(map( (p: any) => !p?.isSuper ))
    },
    {
      name: 'bottleType',
      title: 'Тип баллонов',
      centerHeader: false,
      centerValue: false,
      sortable: true,
      onClick: (price ) => {
        if (price.bottleTypeId) {
          context.router.navigate([`bottle-types/${price.bottleTypeId}`]);
        }
      },
    },
    {
      name: 'price',
      title: 'Цена за 1 баллон, руб.',
      centerHeader: false,
      centerValue: false,
      sortable: true,
    },
    {
      name: 'actualDebit',
      title: 'В наличии, шт.',
      centerHeader: false,
      centerValue: false,
      sortable: false,
    },
  ];
}
