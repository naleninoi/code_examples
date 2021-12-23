import {Component, OnInit} from '@angular/core';
import {IconService} from "../../../../modules/ui/services/icon.service";
import {HttpClient} from "@angular/common/http";
import {BillingService} from "../../../services/billing.service";
import {BillingAccountR, BillingOrderR} from "../../../models/models.interfaces";
import {ActivatedRoute} from "@angular/router";
import {MessagingService} from "../../../../modules/ecosystem/services/messaging.service";
import {FillCustomerAccountComponent} from "../fill-customer-account/fill-customer-account.component";
import {MatDialog} from "@angular/material/dialog";
import * as momentjs from "moment";
import {Sort} from "@angular/material/sort";

@Component({
  selector: 'app-manage-customer-billing',
  templateUrl: './manage-customer-billing.component.html',
  styleUrls: ['./manage-customer-billing.component.scss']
})
export class ManageCustomerBillingComponent implements OnInit {

  public billingAccount: BillingAccountR;

  private customerId: number;

  public $watchSub;

  public moment = (x) => momentjs(x).locale('ru');

  constructor(
    private http: HttpClient,
    public billingService: BillingService,
    public icons: IconService,
    private route: ActivatedRoute,
    private messaging: MessagingService,
    private dialog: MatDialog,
  ) {
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.customerId = params.id;
      this.billingService.getCustomerAccount(this.customerId).subscribe((data: BillingAccountR) => {
          this.acceptData(data);
          this.$watchSub = this.messaging.watch('/updates/account/' + data.id)
            .subscribe((billingData: BillingAccountR) => this.acceptData(billingData));
        }
      );
    });
  }

  acceptData(data) {
    this.billingAccount = data;
  }

  onFillAccountClicked() {
    const dialogRef = this.dialog.open(FillCustomerAccountComponent,
      {
        autoFocus: true,
        restoreFocus: true,
        data: {
          title: 'Пополнить счет',
        }
      });
    dialogRef.afterClosed().subscribe(data => {
      if (data.sum) {
        this.billingService.fillCustomerAccount(this.customerId, data.sum).subscribe(() => {
        });
      }
    });
  }

  onProcessOrderClicked(item: BillingOrderR, event) {
    this.billingService.processBillingOrder(item).subscribe(() => { });
    event.stopPropagation();
  }

  onCancelOrderClicked(item: BillingOrderR, event) {
    this.billingService.cancelBillingOrder(item).subscribe(() => { });
    event.stopPropagation();
  }

}
