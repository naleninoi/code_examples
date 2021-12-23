import { LayoutTopPanelButtonConfig} from '../../../../modules/ui/services/layout.service';
import { environment} from '../../../../environments/environment';
import { FilteredTableComponent} from '../../../../modules/ui/components/lists/filtered-table/filtered-table.component';
import {Status} from '../../../models/models.interfaces';


export function componentButtons(context): Array<LayoutTopPanelButtonConfig> {
  return [
    {
      title: 'Отключить',
      icon: context.icons.getIcon('off'),
      hidden: () =>
        context.table.selection.isEmpty()
        || context.table.selection.selected.filter( bp => bp.isAvailable ).length === 0
        || !((context.table as FilteredTableComponent).allSelectedHaveFlag('allowEdit')),
      action: () => {
        const count = context.table.selection.selected.length;
        const ending1 = count > 1 ? 'ые' : 'ую';
        const ending2 = count > 1 ? 'ы' : 'у';
        context.layout.confirmationDialog(
          `Отключить выбранн${ending1} цен${ending2}?`, 'Отключить', 'Отмена', context.icons.getIcon('warning'))
          .subscribe( ( result ) => {
            if (result) {
              context.massOperation(
                context.table.selection.selected.map( u => u.id),
                environment.api.endpoints.bottlePrices.suspend
              );
            }
          } );
      },
    },
    {
      title: 'Включить',
      icon: context.icons.getIcon('checkCircle'),
      hidden: () =>
        context.table.selection.isEmpty()
        || context.table.selection.selected.filter( bp => !bp.isAvailable ).length === 0
        || !((context.table as FilteredTableComponent).allSelectedHaveFlag('allowEdit')),
      action: () => {
        const count = context.table.selection.selected.length;
        const ending1 = count > 1 ? 'ые' : 'ую';
        const ending2 = count > 1 ? 'ы' : 'у';
        context.layout.confirmationDialog(
          `Включить выбранн${ending1} цен${ending2}?`, 'Включить', 'Отмена', context.icons.getIcon('warning'))
          .subscribe( ( result ) => {
            if (result) {
              context.massOperation(
                context.table.selection.selected.map( u => u.id),
                environment.api.endpoints.bottlePrices.activate
              );
            }
          });
      },
    },
  ];
}
