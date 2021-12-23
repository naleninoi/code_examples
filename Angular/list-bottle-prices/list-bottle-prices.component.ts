import {Component, OnInit, ViewChild} from '@angular/core';
import {environment} from '../../../../environments/environment';
import {FilteredTableComponent} from '../../../../modules/ui/components/lists/filtered-table/filtered-table.component';
import {LayoutService, LayoutTopPanelButtonConfig} from '../../../../modules/ui/services/layout.service';
import {
  FilteredTableColumnConfig,
  FilteredTableFilterConfig
} from '../../../../modules/ui/components/lists/filtered-table/filtered-table.interfaces';
import {componentButtons} from './buttons';
import {componentColumns} from './columns';
import {componentFilters} from './filters';
import {Router} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {AppStateService} from '../../../../modules/ecosystem/services/app-state.service';
import {IconService} from '../../../../modules/ui/services/icon.service';
import {OfficesService} from '../../../services/offices.service';
import {BottleTypesService} from '../../../services/bottle-types.service';

@Component({
  selector: 'app-list-bottle-prices',
  templateUrl: './list-bottle-prices.component.html',
  styleUrls: ['./list-bottle-prices.component.scss']
})
export class ListBottlePricesComponent implements OnInit {

  public title = 'Стоимость баллонов';
  public menuAlias = 'bottle-prices';
  public apiEndpoint = environment.api.endpoints.bottlePrices.list;

  @ViewChild(FilteredTableComponent) table: FilteredTableComponent;
  public buttons: Array<LayoutTopPanelButtonConfig> = componentButtons(this);
  public columns: Array<FilteredTableColumnConfig> = componentColumns(this);
  public filters: Array<FilteredTableFilterConfig> = componentFilters(this);

  public colors = {
    zeroPrice: '#cd0c25',
    unavailable: '#a4aad2'
  };

  @ViewChild('officeColumnTemplate') set officeColumnTemplate(template) {
    this.columns.find( c => c.name === 'office' ).valueTemplate = template;
  }

  @ViewChild('typeColumnTemplate') set typeColumnTemplate(template) {
    this.columns.find( c => c.name === 'bottleType' ).valueTemplate = template;
  }

  @ViewChild('pricesColumnTemplate') set pricesColumnTemplate(template) {
    this.columns.find( c => c.name === 'price' ).valueTemplate = template;
  }

  public watchItemUpdatesDestination = (price) => `/updates/bottle-price/${price.id}`;


  constructor(
    private router: Router,
    private http: HttpClient,
    private layout: LayoutService,
    public appState: AppStateService,
    public icons: IconService,
    private officesService: OfficesService,
    private bottleTypesService: BottleTypesService
  ) { }

  ngOnInit(): void {
  }

  onItemClick(item) {
    return;
  }

  massOperation(ids, apiEndpoint) {
    this.http.post(`${environment.api.url}${apiEndpoint}`, { ids }).subscribe( () => {
      this.table.request();
    });
  }

  catchEnterKeyEvent($event, item): void {
    if ($event.key === 'Enter') {
      this.checkPriceInput(item);
    }
  }

  checkPriceInput(item): void {
    const pattern: RegExp = /^\d+|0[.,]?\d+?$/ ;
    if (pattern.test(item.price)) {
      this.updateItem(item);
    }
  }


  updateItem(item): void {
    let price = item.price;
    if (typeof price === 'string') {
      price = price.replace(',', '.');
      price = parseFloat(price);
    }
    item.price = parseFloat(price.toFixed(2));
    this.http
      .post(environment.api.url + environment.api.endpoints.bottlePrices.update(item), {id: item.id, price: item.price}).subscribe(() => {

    });
  }

}
