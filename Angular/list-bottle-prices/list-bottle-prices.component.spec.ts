import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ListBottlePricesComponent } from './list-bottle-prices.component';

describe('ListBottlePricesComponent', () => {
  let component: ListBottlePricesComponent;
  let fixture: ComponentFixture<ListBottlePricesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ListBottlePricesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ListBottlePricesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
