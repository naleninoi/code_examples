import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageCustomerBillingComponent } from './manage-customer-billing.component';

describe('ManageCustomerBillingComponent', () => {
  let component: ManageCustomerBillingComponent;
  let fixture: ComponentFixture<ManageCustomerBillingComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ManageCustomerBillingComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageCustomerBillingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
