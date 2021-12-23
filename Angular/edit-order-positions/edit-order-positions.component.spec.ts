import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditOrderPositionsComponent } from './edit-order-positions.component';

describe('EditOrderPositionsComponent', () => {
  let component: EditOrderPositionsComponent;
  let fixture: ComponentFixture<EditOrderPositionsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EditOrderPositionsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditOrderPositionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
