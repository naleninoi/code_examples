import {Component, Input, OnInit, Output} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {HttpClient} from '@angular/common/http';
import {BottleTypesService} from '../../../services/bottle-types.service';
import {IconService} from '../../../../modules/ui/services/icon.service';
import {BottlePriceR, OrderPositionR} from '../../../models/models.interfaces';
import {OrderPositionDto} from '../../../models/models.interfaces';
import {BehaviorSubject} from 'rxjs';
import {switchMap} from 'rxjs/operators';

@Component({
  selector: 'app-edit-order-positions',
  templateUrl: './edit-order-positions.component.html',
  styleUrls: ['./edit-order-positions.component.scss']
})
export class EditOrderPositionsComponent implements OnInit {

  public title = 'Добавление баллонов в заказ';

  @Input() orderId;

  @Input()
  public orderPositions = new BehaviorSubject<Array<OrderPositionR>>([]) ;

  @Input()
  public bottlePrices = new BehaviorSubject<Array<BottlePriceR>>([]) ;

  @Output()
  public bottleItems: Array<OrderPositionDto> = [];

  public displayedColumns: string[] = ['bottleTitle', 'actualDebit', 'price', 'bottleQuantity', 'cost'];

  public icons = {
    plus: this.iconSrv.getIcon('plus'),
    minus: this.iconSrv.getIcon('minus'),
    destroy: this.iconSrv.getIcon('close'),
    increase: this.iconSrv.getIcon('left'),
    decrease: this.iconSrv.getIcon('right'),
  };

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private bottleTypesSrv: BottleTypesService,
    public iconSrv: IconService,
  ) { }

  ngOnInit(): void {
    this.initData();
  }

  public initData() {
    this.bottlePrices.
    pipe(
      switchMap(() => this.orderId),
      switchMap( () => this.orderPositions )
    ).subscribe( (op) => {
        if (!op) { return; }
        this.bottleItems = this.bottlePrices.value
          .map( bp => {
          return {
            orderId: this.orderId.value,
            bottleTypeId: bp.bottleTypeId,
            bottleTypeTitle: bp.bottleTypeTitle,
            actualDebit: bp.actualDebit,
            price: op.find( (o: any) => o.bottleTypeId === bp.bottleTypeId )?.price || bp.price,
            quantity: op.find( (o: any) => o.bottleTypeId === bp.bottleTypeId )?.quantity || 0
          };
        } );
        this.orderPositions.value.forEach(
          (o: any) => {
            if (this.bottleItems.filter( bi => bi.bottleTypeId === o.bottleTypeId).length === 0) {
              this.bottleItems.push(
                {
                  orderId: this.orderId.value,
                  bottleTypeId: o.bottleTypeId,
                  bottleTypeTitle: o.bottleTypeTitle,
                  actualDebit: 0,
                  price: o.price,
                  quantity: o.quantity
                }
              );
            }
          }
        );
        this.bottleItems.sort(
          (a, b) => a.bottleTypeTitle.localeCompare(b.bottleTypeTitle)
        );
    }
    );

  }

  public onEntryChange(item: OrderPositionDto, diff: number = 0) {
    item.quantity = parseInt( item.quantity + '', 0 ) || 0;
    if (item.quantity < 0) {
      item.quantity *= -1;
    }
    if (item.quantity + diff > item.actualDebit) {
      diff = 0;
    }
    if (item.quantity > item.actualDebit) {
      item.quantity = item.actualDebit;
    }
    if (item.quantity + diff < 0) {
      diff = 0;
    }
    item.quantity += diff;
  }

  public getTotalCost() {
    return this.bottleItems
      .map(i => (i.quantity * i.price) )
      .reduce( (acc, value) => acc + value, 0 )
      .toFixed(2);
  }

}
