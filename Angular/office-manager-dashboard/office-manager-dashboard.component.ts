import {Component, OnDestroy, OnInit} from '@angular/core';
import {OrdersService} from '../../../services/orders.service';
import {AppStateService} from '../../../../modules/ecosystem/services/app-state.service';
import {OrderR, OrderShortR, OrderStatus, TripR, TripStatus} from '../../../models/models.interfaces';
import * as momentjs from 'moment';
import {IconService} from '../../../../modules/ui/services/icon.service';
import {YaReadyEvent} from 'angular8-yandex-maps/lib/utils/event-manager';
import {TripsService} from '../../../services/trips.service';
import {AddressService} from '../../../services/address.service';
import {BehaviorSubject, zip} from 'rxjs';
import {map} from 'rxjs/operators';
import {MatButtonToggleChange} from '@angular/material/button-toggle';
import {CdkDragDrop, moveItemInArray, transferArrayItem} from '@angular/cdk/drag-drop';
import {MatDialog} from '@angular/material/dialog';
import {EditTripComponent} from '../../trips/edit-trip/edit-trip.component';
import {MatSnackBar} from '@angular/material/snack-bar';
import {MessagingService} from '../../../../modules/ecosystem/services/messaging.service';
import {PushMessagingService} from '../../../../modules/ecosystem/services/push-messaging.service';

@Component({
  selector: 'app-office-manager-dashboard',
  templateUrl: './office-manager-dashboard.component.html',
  styleUrls: ['./office-manager-dashboard.component.scss']
})
export class OfficeManagerDashboardComponent implements OnInit, OnDestroy {

  constructor(
    private ordersService: OrdersService,
    private tripsService: TripsService,
    private appState: AppStateService,
    public icons: IconService,
    public addressService: AddressService,
    private messaging: MessagingService,
    private pushMessagingService: PushMessagingService,
    private dialog: MatDialog,
    private _snackbar: MatSnackBar
  ) {}

  public currentManager;
  public currentOfficeId;

  public dataSourceNew = new BehaviorSubject<Array<OrderR>>([]);
  public dataSourceProcessing = new BehaviorSubject<Array<OrderR>>([]);

  private currentNewOrdersDataSource: 'my_orders' | 'all_orders' = 'my_orders';
  private currentProcessingOrdersDataSource: 'my_orders' | 'all_orders' = 'my_orders';

  public activeTrips: TripR[];

  public colors = {
    customer: '#52b952',
    order: '#262eba',
    address: '#cd0c25'
  };

  public orderDraggedSbj = new BehaviorSubject<OrderR>(null);
  public $watchOrdersList;
  public $watchTripsList;
  public $watchNewOrders;

  public newOrdersInfoButton = false;
  public newOrderIncoming = new Audio('../../../assets/audio/hero_decorative-celebration-01.wav');

  public map: ymaps.Map;
  public mapCenter = [57.76793675, 40.92683938];
  public mapScale = 13;
  public mapControls = this.addressService.mapControls;
  public mapObjectManager: ymaps.ObjectManager;

  public newOrdersFilterOptions = [
    {
      title: 'Мои',
      value: 'myNewOrders'
    },
    {
      title: 'Все',
      value: 'allNewOrders'
    },
  ];

  public processingOrdersFilterOptions = [
    {
      title: 'Мои',
      value: 'myProcessingOrders'
    },
    {
      title: 'Все',
      value: 'allProcessingOrders'
    },
  ];

  public moment = (x) => momentjs(x).locale('ru');

  ngOnInit(): void {
    this.appState.profile.subscribe(p => {
      this.currentManager = p;
      this.currentOfficeId = p.officeId;
    });
    this.getCurrentManagerNewOrders();
    this.getCurrentManagerProcessingOrders();
    this.getActiveTrips();
    this.newOrderIncoming.load();

    this.$watchNewOrders = this.messaging.watch(`/creates/orders/${this.currentOfficeId}`)
      .subscribe( () => {
        switch (this.currentNewOrdersDataSource) {
          case 'my_orders': {
            this.getCurrentManagerNewOrders();
            break;
          }
          case 'all_orders': {
            this.getAllNewOrders();
            break;
          }
        }
        this.newOrdersInfoButton = true;
        this.newOrderIncoming.play();
        setTimeout( () => this.newOrdersInfoButton = false, 10000 );
      } );

    this.$watchOrdersList = this.messaging.watch(`/updates/orders/${this.currentOfficeId}`)
      .subscribe(() => {

        switch (this.currentNewOrdersDataSource) {
          case 'my_orders': {
            this.getCurrentManagerNewOrders();
            break;
          }
          case 'all_orders': {
            this.getAllNewOrders();
            break;
          }
        }

        switch (this.currentProcessingOrdersDataSource) {
          case 'my_orders': {
            this.getCurrentManagerProcessingOrders();
            break;
          }
          case 'all_orders': {
            this.getAllProcessingOrders();
            break;
          }
        }

      });

    this.$watchTripsList = this.messaging.watch(`/updates/trips/${this.currentOfficeId}`)
      .subscribe(() => {
        this.getActiveTrips();
        switch (this.currentProcessingOrdersDataSource) {
          case 'my_orders': {
            this.getCurrentManagerProcessingOrders();
            break;
          }
          case 'all_orders': {
            this.getAllProcessingOrders();
            break;
          }
        }
      });

    this.pushMessagingService.requestSubscriptionToken();
    this.pushMessagingService.getPushMessages();

  }

  ngOnDestroy(): void {
    this.$watchOrdersList.unsubscribe();
    this.$watchTripsList.unsubscribe();
    this.$watchNewOrders.unsubscribe();
  }

  public getCurrentManagerNewOrders() {
    return this.ordersService.getOrdersByManagerAndStatuses(this.currentManager.id, [OrderStatus.NEW], true)
      .subscribe(data => {
        this.dataSourceNew.next(data);
        this.redrawPlacemarks();
      });
  }

  public getAllNewOrders() {
    return this.ordersService.getOrdersByStatuses([OrderStatus.NEW], true)
      .subscribe(data => {
        this.dataSourceNew.next(data);
        this.redrawPlacemarks();
      });
  }

  public getCurrentManagerProcessingOrders() {
    return this.ordersService.getOrdersByManagerAndStatuses(this.currentManager.id, [OrderStatus.PROCESSING], true)
      .subscribe(data => {
        this.dataSourceProcessing.next(data);
        this.redrawPlacemarks();
      });
  }

  public getAllProcessingOrders() {
    return this.ordersService.getOrdersByStatuses([OrderStatus.PROCESSING], true)
      .subscribe(data => {
        this.dataSourceProcessing.next(data);
        this.redrawPlacemarks();
      });
  }

  public getActiveTrips() {
    return this.tripsService.getTripsByStatuses([TripStatus.NEW, TripStatus.PROCESSING])
      .subscribe((data: TripR[]) => {
        this.activeTrips = data.sort((tr1, tr2) => new Date(tr1.dueDate).getTime() - new Date(tr2.dueDate).getTime());
      });
  }

  public getConnectedLists() {
    const connectedLists = ['newOrders'];
    return this.activeTrips?.map(trip => 'trip' + trip.id).concat(connectedLists);
  }

  public onChangeNewOrders(event: MatButtonToggleChange) {
    switch (event.value) {
      case 'myNewOrders': {
        this.getCurrentManagerNewOrders();
        this.currentNewOrdersDataSource = 'my_orders';
        break;
      }
      case 'allNewOrders': {
        this.getAllNewOrders();
        this.currentNewOrdersDataSource = 'all_orders';
        break;
      }
    }
  }

  public onChangeProcessingOrders(event: MatButtonToggleChange) {
    switch (event.value) {
      case 'myProcessingOrders': {
        this.getCurrentManagerProcessingOrders();
        this.currentProcessingOrdersDataSource = 'my_orders';
        break;
      }
      case 'allProcessingOrders': {
        this.getAllProcessingOrders();
        this.currentProcessingOrdersDataSource = 'all_orders';
        break;
      }
    }
  }

  private redrawPlacemarks() {
    if (this.mapObjectManager) {
      this.mapObjectManager.removeAll();
    }
    zip(this.dataSourceNew, this.dataSourceProcessing)
      .pipe(
        // take(1),
        map(data => data.reduce((acc, val) => acc.concat(val)))
      )
      .subscribe(orders => {
        const geoObjects = [];
        orders.forEach((order) => {
          if (!geoObjects.find(object => order.addressId === object.id)) {
            const placemark = this.createPlacemark(order);
            geoObjects.push(placemark);
            if (this.mapObjectManager) {
              this.mapObjectManager.add(placemark);
            }
          }

        });
        if (geoObjects.length > 0 && this.map) {
          this.reCenterMap(geoObjects);
        }
      });
  }

  onMapReady(event: YaReadyEvent<ymaps.Map>): void {
    this.map = event.target;
    this.mapObjectManager = new ymaps.ObjectManager({
      clusterize: true
    });
    this.mapObjectManager.objects.options.set('preset', 'islands#circleIcon');
    this.mapObjectManager.objects.options.set('iconColor', '#3d8fb3');
    this.mapObjectManager.objects.options.set('draggable', 'false');
    this.map.geoObjects.add(this.mapObjectManager);
    this.redrawPlacemarks();
  }

  private createPlacemark(order: OrderR) {
    return {
      type: 'Feature',
      id: order.addressId,
      geometry: {
        type: 'Point',
        coordinates: order.address.coords
      },
      properties: {
        customer: order.customer.title,
        address: order.address.title,
        hintContent: order.address.title,
        balloonContentHeader: order.customer.title,
        balloonContentBody: '',
        balloonContentFooter: order.address.title,
        iconCaption: order.customer.title,
      }
    };
  }

  private reCenterMap(placemarks: Array<any>) {
    const latitudes = placemarks
      .map(placemark => placemark.geometry.coordinates[0])
      .sort((x, y) => x - y);

    const longitudes = placemarks
      .map(placemark => placemark.geometry.coordinates[1])
      .sort((x, y) => x - y);

    const minCoords = [latitudes[0] - 0.02, longitudes[0] - 0.02];
    const maxCoords = [latitudes[latitudes.length - 1] + 0.02, longitudes[longitudes.length - 1] + 0.02];

    this.map.setBounds([minCoords, maxCoords]);
  }

  onDropToNewOrdersList(event: CdkDragDrop<Array<OrderR>>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex);
    } else {
      this.updateOrder(
        event.previousContainer.data[event.previousIndex],
        OrderStatus.NEW
      );
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex);
    }
  }

  onDropToProcessingOrdersList(event: CdkDragDrop<Array<OrderR>>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(
        event.container.data,
        event.previousIndex,
        event.currentIndex);
    } else {
      this.updateOrder(
        event.previousContainer.data[event.previousIndex],
        OrderStatus.PROCESSING
      );
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex);
    }
  }

  onDropProcessingOrderToTrip(event: CdkDragDrop<TripR>) {
    if (event.isPointerOverContainer) {
      const order = this.dataSourceProcessing.value[event.previousIndex];
      const trip = event.container.data;
      const overload = this.checkTripOverload(trip, order);
      if (!overload) {
        this.dataSourceProcessing.value.splice(event.previousIndex, 1);
        this.tripsService.addOrderToTrip(trip.id, order.id).subscribe(() => {
        });
      } else {
        this._snackbar.open('Превышена грузоподъемность автомобиля', null, {duration: 2000});
      }
    }
  }

  private updateOrder(order: OrderR | OrderShortR, newStatus: OrderStatus) {
    order.status = newStatus;
    this.ordersService.updateOrderStatus(order).subscribe(() => {
    });
  }

  public onOrderTakenByManager(order: OrderR) {
    this.ordersService.takeOrderToCurrentManager(order).subscribe(() => {
    });
  }

  public onOrderDragged(order: OrderR) {
    this.orderDraggedSbj.next(order);
  }

  public onOrderDropped() {
    this.orderDraggedSbj.next(null);
  }

  public onMapCenteredToOrder(order: OrderR) {
    this.mapCenter = order.address.coords;
    this.map.setZoom(16);
  }

  public onTripAddClick() {
    const dialogRef = this.dialog.open(EditTripComponent,
      {
        ariaLabelledBy: 'Создать новый рейс',
        autoFocus: true,
        restoreFocus: true
      });
    dialogRef.afterClosed().subscribe(result => {
    });
  }

  private checkTripOverload(trip: TripR, order: OrderR): boolean {
    const tripLoad = trip.totalWeight;
    const orderWeight = order.bottleWeight;
    const autoCapacity = trip.auto.capacity;
    return tripLoad + orderWeight > autoCapacity;
  }

}
