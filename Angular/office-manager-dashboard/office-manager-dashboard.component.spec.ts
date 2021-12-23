import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OfficeManagerDashboardComponent } from './office-manager-dashboard.component';

describe('OfficeManagerDashboardComponent', () => {
  let component: OfficeManagerDashboardComponent;
  let fixture: ComponentFixture<OfficeManagerDashboardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OfficeManagerDashboardComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OfficeManagerDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
