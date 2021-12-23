import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {FormControl} from '@angular/forms';
import {FormComponent, FormConfig, FormField} from '../../../../modules/ui/components/ui-form/ui-form.component';
import {filter, map, skip, switchMap, tap} from 'rxjs/operators';
import {environment} from '../../../../environments/environment';
import {BottlePriceR, Order, OrderPositionR, UserType} from '../../../models/models.interfaces';
import {HttpClient} from '@angular/common/http';
import {ActivatedRoute, Router} from '@angular/router';
import {LayoutService} from '../../../../modules/ui/services/layout.service';
import {AppStateService} from '../../../../modules/ecosystem/services/app-state.service';
import {IconService} from '../../../../modules/ui/services/icon.service';
import {UserService} from '../../../services/user.service';
import {OfficesService} from '../../../services/offices.service';
import {EditItemFormComponent} from '../../../../modules/ui/core/base-form/edit-item-form.component';
import {OrdersService} from '../../../services/orders.service';
import {AddressService} from '../../../services/address.service';
import {EditOrderPositionsComponent} from '../edit-order-positions/edit-order-positions.component';
import {BottlePricesService} from '../../../services/bottle-prices.service';
import {EditOrderReturnBottlesComponent} from "../edit-order-return-bottles/edit-order-return-bottles.component";

@Component({
  selector: 'app-edit-order',
  templateUrl: './edit-order.component.html',
  styleUrls: ['./edit-order.component.scss']
})
export class EditOrderComponent extends EditItemFormComponent implements OnInit, OnDestroy {

  public mode: null | 'create' | 'edit';

  public title = new BehaviorSubject<string>('Редактирование заказа');
  public menuAlias = 'orders';

  public editedObject: Order = null;
  public orderIdSbj = new BehaviorSubject(null);
  public buttonReturnAllSbj = new BehaviorSubject<boolean>(false);


  @ViewChild(FormComponent) form: FormComponent;
  @ViewChild(EditOrderPositionsComponent) bottleTypesOrdered: EditOrderPositionsComponent;
  @ViewChild(EditOrderReturnBottlesComponent) bottlesReturned: EditOrderReturnBottlesComponent;


  private statusHiddenSbj = new BehaviorSubject<boolean>(false);
  public currentCustomerIdSbj = new BehaviorSubject<number>(null);
  private currentOfficeIdSbj = new BehaviorSubject<number>(null);
  public orderReturnBottles = new BehaviorSubject<Array<any>>([]);
  public orderPositions = new BehaviorSubject<Array<OrderPositionR>>([]);
  public bottlePrices = new BehaviorSubject<Array<BottlePriceR>>([]);
  private skipTimes: number;

  public formConfig: FormConfig = {
    fields: [
      {
        name: 'officeId',
        title: 'Офис',
        control: new FormControl(''),
        type: 'select',
        options: this.officesService.officesFormOptions,
        optionTitle: 'title',
        optionValue: 'id',
        hidden: this.appState.profile.pipe(
          map(p => !p?.isSuper),
        ),
      },

      {
        name: 'customerId',
        title: 'Компания-клиент',
        control: new FormControl(''),
        type: 'autocomplete',
        optionTitle: 'title',
        optionValue: 'id',
        hidden: this.appState.profile.pipe(
          map(p => p?.userType === 'CUSTOMER'),
        ),
        defaultValue: null,
        autocompleteRequest: (search: string) => {
          let chosenOfficeId;
          this.officeIdField.control.value ? chosenOfficeId = this.officeIdField.control.value : chosenOfficeId = -1;
          return this.http.get(environment.api.url
            + environment.api.endpoints.customers.list
            + '?&officeId=' + chosenOfficeId
            + '&search=' + encodeURIComponent(search)).pipe(
            map((data: any) => data?.items || []),
            map(
              (customers: Array<any>) =>
                customers.map(customer => ({value: customer.id, title: customer.title}))
            )
          );
        },
        autocompleteRequestObject: (id: any) => {
          return this.http.get(environment.api.url + environment.api.endpoints.customers.get(id)).pipe(
            map((customer: any) => ({value: customer.id, title: customer.title}))
          );
        },
      },

      {
        name: 'customerUserId',
        title: 'Сотрудник клиента',
        control: new FormControl(''),
        type: 'select',
        options: this.userService.getUsernamesByTypeAndCustomer(UserType.CUSTOMER, this.currentCustomerIdSbj),
        optionTitle: 'fullName',
        optionValue: 'id',
        hidden: this.appState.profile.pipe(
          map(p => p?.userType === 'CUSTOMER'),
        ),
      },

      {
        name: 'officeUserId',
        title: 'Менеджер',
        control: new FormControl(''),
        type: 'select',
        options: this.userService.getUsernamesByTypeAndOffice(UserType.OFFICE_MANAGER, this.currentOfficeIdSbj),
        optionTitle: 'fullName',
        optionValue: 'id',
        hidden: this.appState.profile.pipe(
          map(p => p?.userType === 'OFFICE_MANAGER' || p?.userType === 'CUSTOMER'),
        ),
      },

      {
        name: 'addressId',
        title: 'Адрес доставки',
        control: new FormControl(''),
        type: 'select',
        options: this.addressService.getAddressesByCustomer(this.currentCustomerIdSbj).pipe(
          tap(addrs => {
            const defaultId =  addrs.length > 0 ? addrs.find(addr => addr?.default).id : 0;
            if (this.mode !== 'edit') {
              this.addressIdField.control.setValue(defaultId);
            }
          }),
        ),
        optionTitle: 'title',
        optionValue: 'id',
        required: true,
        errorMessages: 'Необходимо выбрать адрес доставки заказа'
      },

      {
        name: 'status',
        title: 'Статус заказа',
        control: new FormControl(''),
        type: 'select',
        options: this.ordersService.orderStatusOptions,
        optionTitle: 'title',
        optionValue: 'type',
        defaultValue: 'NEW',
        hidden: this.appState.profile.pipe(
          map(p => p?.userType === 'CUSTOMER'),
          switchMap(isCustomer => {
            if (isCustomer) {
              return of(true);
            } else {
              return this.statusHiddenSbj;
            }
          }),
        ),
      },

      {
        name: 'orderPositions',
        control: new FormControl(''),
        hidden: of(true),
        value: this.bottleTypesOrdered?.bottleItems
      }
    ],
  };

  public get officeIdField(): FormField {
    return this.formConfig.fields.find(f => f.name === 'officeId');
  }

  public get customerIdField(): FormField {
    return this.formConfig.fields.find(f => f.name === 'customerId');
  }

  public get customerUserIdField(): FormField {
    return this.formConfig.fields.find(f => f.name === 'customerUserId');
  }

  public get addressIdField(): FormField {
    return this.formConfig.fields.find(f => f.name === 'addressId');
  }

  constructor(
    private http: HttpClient,
    private router: Router,
    private layoutService: LayoutService,
    private activatedRoute: ActivatedRoute,
    private appState: AppStateService,
    public icon: IconService,
    private userSrv: UserService,
    private officesService: OfficesService,
    private ordersService: OrdersService,
    private userService: UserService,
    private addressService: AddressService,
    private bottlePricesService: BottlePricesService
  ) {
    super(activatedRoute, layoutService, icon);
  }

  public ngOnInit() {
    super.ngOnInit();
    this.activatedRoute.data.subscribe((data: any) => this.mode = data.mode);

    this.customerIdField.control.valueChanges.pipe(
      skip(2),
      tap(() => {
        this.customerUserIdField.control.reset();
        this.addressIdField.control.reset();
      }),
      filter(val => Number.isInteger(val))
    ).subscribe(this.currentCustomerIdSbj);

    this.officeIdField.control.valueChanges.pipe(
      skip(this.skipTimes),
      tap(() => {
        this.form.dropField(this.customerIdField, null);
        this.customerUserIdField.activeOptionValue = this.customerUserIdField.defaultValue;
        this.customerUserIdField.control.reset();
        this.addressIdField.activeOptionValue = this.addressIdField.defaultValue;
        this.addressIdField.control.reset();
        this.currentCustomerIdSbj.next(0);
      })
    ).subscribe(this.currentOfficeIdSbj);

    this.appState.profile
      .subscribe((p: any) => {
      if (!!p.officeId) {
        this.currentOfficeIdSbj.next(p.officeId);
      }
      if (!!p.customerId) {
        this.currentCustomerIdSbj.next(p?.customerId);
      }
    });

    this.bottlePricesService.getBottlePricesByOffice(this.currentOfficeIdSbj).subscribe(this.bottlePrices);

  }

  protected getEditedObject(id): Observable<any> {
    this.skipTimes = 1;
    return this.http
      .get(environment.api.url + environment.api.endpoints.orders.get(id))
      .pipe(
        tap(order => {
          this.currentOfficeIdSbj.next(order.officeId);
          this.currentCustomerIdSbj.next(order.customerId);
          this.orderPositions.next(order.orderPositions);
          this.orderReturnBottles.next(order.orderReturnBottles);
          this.orderIdSbj.next(order.id);
        })
      );
  }

  protected initEditedObject(): Observable<any> {
    this.skipTimes = 0;
    this.title.next('Создание заказа');
    this.statusHiddenSbj.next(true);
    const initialObject = {};
    this.formConfig.fields.forEach( field => {
      if (field.defaultValue !== undefined) {
        initialObject[field.name] = field.defaultValue;
      }

    } );
    return of(initialObject);
  }

  protected saveEditedObject(values): Observable<any> {
    if (!this.form.isValid()) {
      this.form.validate();
      return of(false);
    }
    values.orderPositions = this.bottleTypesOrdered.bottleItems.filter(bi => bi.quantity !== 0);
    values.orderReturnBottles = this.bottlesReturned.bottleReturnItems.filter(bi => bi.returnQuantity !== 0);
    if (values.id) {
      return this.http
        .post(environment.api.url + environment.api.endpoints.orders.update(values), values);
    } else {
      return this.http
        .post(environment.api.url + environment.api.endpoints.orders.create(), values);
    }
  }

  onButtonReturnAllClicked() {
    this.buttonReturnAllSbj.next(true);
  }

}
