import { AfterContentInit, Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { ModalSubcriptionService } from "../../../../../infrastructure/global/components/modal-window/modal-subscribtion/modal-subscribtion.service";
import { GetKeyTagModalComponent } from "../../modal/get-key-tag-modal/get-key-tag-modal.component";
import { SetKeyTagModalComponent } from "../../modal/set-key-tag-modal/set-key-tag-modal.component";
import { KeyTagTableItem } from "../../../../models/shiftlog-card/key-tag/key-tag-table-item";
import { ShiftLogFull } from "../../../../models/shiftlog-card/full/shift-log-full";
import { ShiftFull } from "../../../../models/shiftlog-card/full/shift-full";
import * as wjGrid from "@grapecity/wijmo.grid";
import { KeyTagsApiservice } from "../../../../services/key-tags.apiservice";
import { hasItems, hasValue } from "../../../../../infrastructure/global/services/helper.service";
import { ShiftEquipmentFull } from "../../../../models/shiftlog-card/full/shift-equipment-full";
import { FilterObject } from "../../../../../infrastructure/sharedMembers/classes/filter-object";
import { FilterOperation } from "../../../../../infrastructure/sharedMembers/classes/filter-operation.enum";
import { ShiftKeyTagFull } from "../../../../models/shiftlog-card/full/shift-key-tag-full";
import { ShiftKeyTagSave } from "../../../../models/shiftlog-card/save/shift-key-tag-save";
import { ShiftLogCardApiService } from "../../../../services/shift-log-card-api.service";
import { BehaviorSubject, Observable, Subscription } from "rxjs";
import { NgForm } from "@angular/forms";
import { KeyTagTransferFull } from "../../../../models/key-tag/key-tag-transfer-full";
import { KeyTagStatusEnum } from "../../../../models/shiftlog-card/key-tag/key-tag-status.enum";
import { KeyTagShort } from "../../../../models/key-tag/key-tag-short";
import { KeyTagTypeEnum } from "../../../../enums/key-tag-type.enum";
import { EmployeeShort } from "../../../../../employees/models/employee-short";
import { UserService } from "../../../../../infrastructure/global/services/user.service";
import { EmployeeHelper } from "../../../../../employees/services/employee.helper";
import { ShiftLogCardViewModel } from "../../shift-log-card-viewmodel";
import { Formatter } from "../../../../../infrastructure/sharedMembers/classes/staff/formatter";
import { ShiftShort } from "../../../../models/shiftlog-card/shift-short";
import { ShiftLogFormModeEnum } from "../../shift-log-card.component";
import { ShiftLogSettingVersionFull } from "../../../../models/shiftlog-card/full/shift-log-setting-version-full";

/** Компонента раздела "Ключ-бирки" карты Журнала */
@Component({
    selector: 'shift-log-card-key-tags',
    templateUrl: './shift-log-card-key-tags.component.html',
    styles: [`
        .erroneous-receiver {
            color: #d70e0e;
        }
    `]
})
export class ShiftLogCardKeyTagsComponent implements OnInit, AfterContentInit, OnDestroy {
    ShiftLogFormModeEnum = ShiftLogFormModeEnum;

    /** Компонент таблицы "Ключ-бирки". */
    @ViewChild("keyTagsFlexGrid") keyTagsFlexGrid: wjGrid.FlexGrid;

    /** Данные для таблицы КБ */
    keyTagTableData: KeyTagTableItem[] = [];

    /** Данные карты */
    @Input()
    card: ShiftLogFull;

    /** Данные карты */
    @Input()
    viewModel: ShiftLogCardViewModel;

    /** Недоступность полей */
    @Input()
    isViewDisabled: boolean;

    /** Наличие прав на редактирование всей карты */
    @Input() hasFullEditPermission: boolean;

    /** Наличие прав на редактирование карты, в качестве ответственного лица */
    @Input() hasEditPermissionAsResponsible: boolean;

    /** Наличие прав на редактирование карты, в качестве ответственного за устранение лица. */
    @Input() hasFixPermission: boolean;

    /** Форма с карты Журнала. */
    @Input() cardForm: NgForm;

    _formMode: ShiftLogFormModeEnum;
    /** Режим отображения формы журнала. */
    @Input()
    set formMode(newValue: ShiftLogFormModeEnum) {
        if (this._formMode === newValue) {
            return;
        }
        // пропускаем первую инициализацию,
        // чтобы избежать повторной загрузки КБ при инициализации смены
        if (!hasValue(this._formMode) && hasItems(this.card.keyTags)) {
            this._formMode = newValue;
            return;
        }

        this.keyTagTableData = [];
        switch (newValue) {
            case ShiftLogFormModeEnum.Shifts:
                if (this._currentShift) {
                    this.onShiftSet(this._currentShift);
                } else if (!hasItems(this.card.shifts)) {
                    this.fillKeyTagTableForNoShifts();
                } else {
                    this.setNoShiftKeyTags();
                }
                break;
            case ShiftLogFormModeEnum.Versions:
                break;
        }
        this._formMode = newValue;
    }

    _selectedVersion: ShiftLogSettingVersionFull;
    /** Выбранная версия настроек журнала. */
    @Input() set selectedVersion(newValue: ShiftLogSettingVersionFull) {
        if (this._selectedVersion === newValue) {
            return;
        }
        this._selectedVersion = newValue;
        this.fillKeyTagTableForVersion(this._selectedVersion);
    }

    /** Неактуальный журнал */
    @Input() isInactualLog = false;

    /** Наличие прав на редактирование карты, в закрытых сменах */
    @Input() hasEditClosedShiftPermission: boolean;

    _updateNoShift$: Observable<ShiftLogFull>;

    @Input()
    get updateNoShift$() {
        return this._updateNoShift$;
    }

    set updateNoShift$(observable: Observable<ShiftLogFull>) {
        if (observable) {
            const sub = observable.subscribe((card: ShiftLogFull) => {
                this.card = card;
                this.setNoShiftKeyTags();
            });
            this._subscriptions.push(sub);
        }
    }

    /** Сотрудник текущего пользователя. */
    userEmployee: EmployeeShort;

    /** Оборудование SAP текущей смены */
    equipmentSap: ShiftEquipmentFull[] = [];

    /** Оборудование без SAP текущей смены */
    equipmentWithoutSap: ShiftEquipmentFull[] = [];

    /** Подписки компонента. */
    private _subscriptions: Subscription[] = [];

    /** Событие изменения Типа журнала для подписки. */
    @Input()
    logTypeChange$: Observable<void>;

    /** Событие изменения рабочего места для подписки. */
    @Input()
    mainEquipmentChange$: Observable<void>;

    /** Сабжект события принятия всех КБ периодического журнала. */
    @Input()
    acceptKeyTagsSubject: BehaviorSubject<boolean>;

    /** Текущая смена */
    _currentShift: ShiftFull;
    @Input("currentShift")
    get currentShift() {
        return this._currentShift;
    }

    set currentShift(newShift: ShiftFull) {
        this._currentShift = newShift;
        if (this._formMode === ShiftLogFormModeEnum.Shifts) {
            this.keyTagTableData = [];
            if (newShift) {
                this.onShiftSet(newShift);
            } else {
                this.setNoShiftKeyTags();
            }
        }
    }

    /** Событие изменения ключей-бирок после изменения оборудования САП. */
    @Output() onEquipmentSapKeyTagsChanged: EventEmitter<any> = new EventEmitter<any>();

    /** Событие удаление ключей-бирок после удаления оборудования или удаления КБ из оборудования без привязки к САП. */
    @Output() onEquipmentRemoveKeyTags: EventEmitter<KeyTagShort[]> = new EventEmitter<KeyTagShort[]>();

    constructor(public modalSubscriptionService: ModalSubcriptionService,
                public translate: TranslateService,
                private userDataService: UserService,
                private employeeHelper: EmployeeHelper,
                private keyTagApiService: KeyTagsApiservice,
                private shiftLogCardApiService: ShiftLogCardApiService,
                private formatter: Formatter) {
        this.initCurrentUserEmployee();
    }

    ngOnInit(): void {
        // подписка на изменение типа журнала
        const logTypeChangeSub = this.logTypeChange$.subscribe(() => {
            this.filterKeyTagsByLogType();
        });
        this._subscriptions.push(logTypeChangeSub);

        // подписка на изменение оборудования Рабочего места
        const mainEquipmentChangeSub = this.mainEquipmentChange$.subscribe(() => {
            if (hasValue(this.currentShift) && hasItems(this.currentShift.shiftEquipment)) {
                this.equipmentSap = this.currentShift.shiftEquipment.filter(eq => !!eq.equipment);
            } else {
                this.equipmentSap = [];
            }
            this.fillKeyTagTableForVersion(this._selectedVersion).then(() => {
                let removedKeyTags = this.getOrphanKeyTags();
                this.updateKeyTagsWithTableItems(this.keyTagTableData);
                if (hasItems(removedKeyTags)) {
                    this.onEquipmentRemoveKeyTags.emit(removedKeyTags);
                }
            });
        });
        this._subscriptions.push(mainEquipmentChangeSub);
    }

    /** @inheritDoc */
    ngAfterContentInit() {
        this._subscriptions.push(this.viewModel.selectedShiftDateChangeSubject.subscribe(() => {
            if (!hasValue(this.currentShift)) {
                this.setNoShiftKeyTags();
            }
        }));
    }

    /** @inheritDoc */
    ngOnDestroy(): void {
        this._subscriptions.forEach(sub => {
            if (sub) sub.unsubscribe();
        });
    }

    /**
     * Помечаем форму, как измененную.
     * */
    markAsDirty(): void {
        this.cardForm.form.markAsDirty();
        this.viewModel.hasShiftChanges = true;
    }

    /** Вызов модального окна "Получение ключ-бирок" */
    public openGetKeyTagModal() {
        let bsModalRef = this.modalSubscriptionService.show(GetKeyTagModalComponent, {
            initialState: {
                keyTagsTable: this.selectKeyTagsToReceive(),
                userEmployee: this.userEmployee
            }
        });

        bsModalRef.content.okSubject.subscribe((modifiedItems: KeyTagTableItem[]) => {
            modifiedItems.forEach(item => {
                const itemIndex = this.keyTagTableData.findIndex(el => el.keyTag.id === item.keyTag.id);
                this.keyTagTableData[itemIndex] = item;
                let keyTagTransfers = this.keyTagTableData[itemIndex].keyTagTransfers;
                this.keyTagTableData[itemIndex].isFromStorage = hasItems(keyTagTransfers)
                && keyTagTransfers.length > 1
                    ? keyTagTransfers[keyTagTransfers.length - 2].forStorage
                    : false;
            });
            this.updateKeyTagsWithTableItems(modifiedItems);
            this.filterTransfers();
            this.checkAllKeyTagsAccepted();
        });
    }

    /** Вызов модального окна "Передача ключ-бирок" */
    /** @param isCorrectionMode - в режиме "Исправить ошибку в передаче" */
    public openSetKeyTagModal(isCorrectionMode = false) {
        const keyTagItems = isCorrectionMode ? this.selectKeyTagsToCorrect() : this.selectKeyTagsToIssue();
        let bsModalRef = this.modalSubscriptionService.show(SetKeyTagModalComponent, {
            initialState: {
                keyTagsTable: keyTagItems,
                userEmployee: this.userEmployee,
                isCorrectionMode: isCorrectionMode,
                isLogTypePeriodic: this.logTypePeriodic
            },
            class: 'ngx-modal-fullscreen modal-lg'
        });

        bsModalRef.content.okSubject.subscribe(modifiedItems => {
            modifiedItems.forEach(item => {
                const itemIndex = this.keyTagTableData.findIndex(el => el.keyTag.id === item.keyTagId);
                if (isCorrectionMode) {
                    const lastTransferIndex = this.keyTagTableData[itemIndex].keyTagTransfers.length - 1;
                    this.keyTagTableData[itemIndex].keyTagTransfers[lastTransferIndex] = item.transferData;
                } else {
                    this.keyTagTableData[itemIndex].keyTagTransfers.push(item.transferData);
                }
                this.keyTagTableData[itemIndex].status = KeyTagStatusEnum.inTransmission;
                let keyTagTransfers = this.keyTagTableData[itemIndex].keyTagTransfers;
                this.keyTagTableData[itemIndex].isFromStorage = hasItems(keyTagTransfers)
                && keyTagTransfers.length > 1
                    ? keyTagTransfers[keyTagTransfers.length - 2].forStorage
                    : false;
            });
            this.updateKeyTagsWithTableItems(this.keyTagTableData);
            this.filterTransfers();
            this.checkAllKeyTagsAccepted();
        });
    }

    /** выдал */
    getIssuerNotForStorageFioAndDate(cell, type: 'fio' | 'date') {
        const issueRecord = hasItems(cell.item.keyTagTransfers)
            ? cell.item.keyTagTransfers[cell.item.keyTagTransfers.length - 1]
            : null;
        const issuerEmployee = issueRecord && issueRecord.issuerEmployee && !issueRecord.forStorage
            ? issueRecord.issuerEmployee
            : null;
        if (type === 'fio') {
            return issuerEmployee ? issuerEmployee.fio : "";
        }
        if (type === 'date') {
            return issuerEmployee ? `${issueRecord.issueDateTime ? issueRecord.issueDateTime : ''}` : "";
        }
    }

    /** сдал */
    getIssuerForStorageFioAndDate(cell, type: 'fio' | 'date') {
        const issueRecord = hasItems(cell.item.keyTagTransfers)
            ? cell.item.keyTagTransfers[cell.item.keyTagTransfers.length - 1]
            : null;
        const issuerEmployee = issueRecord && issueRecord.issuerEmployee && issueRecord.forStorage
            ? issueRecord.issuerEmployee
            : null;
        if (type === 'fio') {
            return issuerEmployee ? issuerEmployee.fio : "";
        }
        if (type === 'date') {
            return issuerEmployee ? `${issueRecord.issueDateTime ? issueRecord.issueDateTime : ''}` : "";
        }
    }

    /** получил */
    getReceiverNotForStorageFioAndDate(cell, type: 'fio' | 'date') {
        const receiptRecord = hasItems(cell.item.keyTagTransfers)
            ? cell.item.keyTagTransfers[cell.item.keyTagTransfers.length - 1]
            : null;
        const receiverEmployee = receiptRecord && receiptRecord.receiverEmployee && !receiptRecord.forStorage
            ? receiptRecord.receiverEmployee
            : null;
        if (type === 'fio') {
            return receiverEmployee ? receiverEmployee.fio : "";
        }
        if (type === 'date') {
            return receiverEmployee ? `${receiptRecord.receiptDateTime ? receiptRecord.receiptDateTime : ''}` : "";
        }
    }

    /** Ошибочно получивший сотрудник  */
    getErroneousReceiverNotForStorage(cell) {
        const receiptRecord = hasItems(cell.item.keyTagTransfers)
            ? cell.item.keyTagTransfers[cell.item.keyTagTransfers.length - 1]
            : null;
        const erroneousReceiverEmployee = receiptRecord && receiptRecord.erroneouslyReceivedEmployee && !receiptRecord.forStorage
            ? receiptRecord.erroneouslyReceivedEmployee
            : null;
        return erroneousReceiverEmployee ? erroneousReceiverEmployee.fio : "";
    }

    /** принял */
    getReceiverForStorageFioAndDate(cell, type: 'fio' | 'date') {
        const receiptRecord = hasItems(cell.item.keyTagTransfers)
            ? cell.item.keyTagTransfers[cell.item.keyTagTransfers.length - 1]
            : null;
        const receiverEmployee = receiptRecord && receiptRecord.receiverEmployee && receiptRecord.forStorage
            ? receiptRecord.receiverEmployee
            : null;
        if (type === 'fio') {
            return receiverEmployee ? receiverEmployee.fio : "";
        }
        if (type === 'date') {
            return receiverEmployee ? `${receiptRecord.receiptDateTime ? receiptRecord.receiptDateTime : ''}` : "";
        }
    }

    /** Ошибочно принявший КБ сотрудник  */
    getErroneousReceiverForStorage(cell) {
        const receiptRecord = hasItems(cell.item.keyTagTransfers)
            ? cell.item.keyTagTransfers[cell.item.keyTagTransfers.length - 1]
            : null;
        const erroneousReceiverEmployee = receiptRecord && receiptRecord.erroneouslyReceivedEmployee && receiptRecord.forStorage
            ? receiptRecord.erroneouslyReceivedEmployee
            : null;
        return erroneousReceiverEmployee ? erroneousReceiverEmployee.fio : "";
    }

    /** Является ли выбранная смена открытой. */
    isCurrentShiftOpen(): boolean {
        return this.shiftIsOpen(this.currentShift);
    }

    /** Является ли смена открытой. */
    shiftIsOpen(shift: ShiftShort): boolean {
        return shift
            && !shift.endDateTime
            && shift.startDateTime != null;
    }

    /**
     * Перерисовывает таблицу "КБ".
     */
    private refreshTableGridView() {
        setTimeout(() => {
            if (this.keyTagsFlexGrid && this.keyTagsFlexGrid.collectionView) {
                this.keyTagsFlexGrid.collectionView.refresh();
            }
        }, 0);
    }

    /** Заполняет данные сотрудника, связанного с текущим пользователя. */
    private initCurrentUserEmployee() {
        const currentUser = this.userDataService.getCurrentUser();
        let userEmployee = new EmployeeShort();
        userEmployee.id = currentUser.employeeId;
        userEmployee.fio = this.employeeHelper.getfio(currentUser.firstName, currentUser.lastName, currentUser.secondName);
        userEmployee.isActual = true;
        this.userEmployee = userEmployee;
    }

    /** Заполняет таблицу КБ для версии настройки. */
    private async fillKeyTagTableForVersion(version: ShiftLogSettingVersionFull) {
        this.keyTagTableData = [];
        const versionKeyTags = await this.getKeyTagsFromVersion(version);
        this.keyTagTableData.pushRange(versionKeyTags.map(keyTag => {
                const result = new KeyTagTableItem();
                result.keyTag = keyTag;
                return result;
            })
        );
        this.refreshTableGridView();
    }

    /** Заполняет таблицу КБ для версии настройки. */
    private async fillKeyTagTableForNoShifts() {
        this.keyTagTableData = [];
        const actualVersion = this.viewModel.getLastVersion();
        let versionKeyTags = await this.getKeyTagsFromVersion(actualVersion);
        if (this.logTypePeriodic) {
            this.keyTagTableData.pushRange(this.card.keyTags.map(keyTag => this.getKeyTagTableItem(keyTag)));
            const cardKeyTagIds = this.card.keyTags.map(cardKeyTag => cardKeyTag.keyTag.id);
            versionKeyTags = versionKeyTags.filter(item => !cardKeyTagIds.includes(item.id));
        }

        this.keyTagTableData.pushRange(versionKeyTags.map(keyTag => {
                const result = new KeyTagTableItem();
                result.keyTag = keyTag;
                if (this._formMode === ShiftLogFormModeEnum.Shifts) {
                    result.status = KeyTagStatusEnum.inStorage;
                    result.keyTagTransfers = [];
                    result.isFromStorage = false;
                }
                return result;
            })
        );
        this.refreshTableGridView();
    }

    /** Возвращает все КБ, связанные с версией. */
    private async getKeyTagsFromVersion(version: ShiftLogSettingVersionFull): Promise<KeyTagShort[]> {
        if (!version || !hasItems(version.equipment)) {
            return [];
        }
        const noSapEquipmentsKeyTags = version.equipment.filter(x => x.keyTag &&
            !this.keyTagTableData.some(y => y.keyTag.id === x.keyTag.id)).map(x => x.keyTag);
        noSapEquipmentsKeyTags.deleteDuplicateById();

        const equipmentIds = version.equipment
            .filter(eq => !!eq.equipment)
            .map(eq => eq.equipment.id);
        if (this.card.equipment) {
            equipmentIds.push(this.card.equipment.id);
        }
        const sapEquipmentsKeyTags = await this.getEquipmentKeyTags(equipmentIds);
        return [...noSapEquipmentsKeyTags, ...sapEquipmentsKeyTags];
    }

    /** Заполняет таблицу КБ из КБ, связанных со сменой */
    private fillKeyTagTableFromCurrentShift(shift: ShiftFull) {
        this.setKeyTagTableData(shift.keyTags);
    }

    /** Заполняет таблицу КБ ключ-биркой рабочего места карты и КБ последней версии оборудования. */
    private fillKeyTagTableForPeriodical() {
        if (!hasItems(this.card.keyTags)) {
            return;
        }
        let keyTags = [];
        if (hasValue(this.card.equipment)) {
            keyTags.pushRange(this.card.keyTags.filter(k => this.card.equipment.id === k.keyTag.equipmentId));
        }
        const lastVersion = this.viewModel.getLastVersion();
        if (lastVersion && hasItems(lastVersion.equipment)) {
            const equipmentIds = lastVersion.equipment
                .filter(eq => !!eq.equipment)
                .map(eq => eq.equipment.id);
            const keyTagIds = lastVersion.equipment
                .filter(eq => !eq.equipment)
                .filter(e => hasValue(e.keyTag))
                .map(e => e.keyTag.id);
            keyTags.pushRange(this.card.keyTags.filter(k => equipmentIds.includes(k.keyTag.equipmentId)));
            keyTags.pushRange(this.card.keyTags.filter(k => keyTagIds.includes(k.keyTag.id)));
        }

        this.setKeyTagTableData(keyTags);
        this.checkAllKeyTagsAccepted();
    }

    /** Заполняет таблицу КБ ключ-биркой рабочего места карты. */
    private fillKeyTagTableForConstant() {
        let keyTags = [];

        if (hasValue(this.card.equipment)) {
            keyTags.pushRange(this.card.keyTags.filter(k => this.card.equipment.id === k.keyTag.equipmentId));
        }

        this.setKeyTagTableData(keyTags);
    }

    /** Устанавливает значения для таблицы КБ. */
    private setKeyTagTableData(keyTags: ShiftKeyTagFull[]) {
        if (!hasItems(keyTags)) {
            return;
        }
        keyTags.forEach(shiftKeyTag => {
            let tableItem = this.getKeyTagTableItem(shiftKeyTag);
            if (this.logTypePeriodic) {
                let date = this.viewModel.selectedShiftDate;
                tableItem.keyTagTransfers = tableItem.keyTagTransfers
                    .filter(tr => hasValue(tr.receiptDateTime) && this.formatter.areSameDay(date, tr.receiptDateTime)
                        || hasValue(tr.issueDateTime) && this.formatter.areSameDay(date, tr.issueDateTime));
            }
            this.keyTagTableData.push(tableItem);
        });
        this.refreshTableGridView();
    }

    /** Формирует из КБ значение для отображения в таблице. */
    private getKeyTagTableItem(keyTag: ShiftKeyTagFull): KeyTagTableItem {
        let tableItem = new KeyTagTableItem();
        tableItem.keyTag = keyTag.keyTag;
        tableItem.keyTagTransfers = hasItems(keyTag.keyTagTransfers) ? keyTag.keyTagTransfers : [];
        tableItem.status = this.getKeyTagStatusByLastTransfer(tableItem.keyTagTransfers);
        tableItem.isFromStorage = this.getKeyTagIsFromStorage(tableItem);
        return tableItem;
    }

    /** Возвращает статус КБ на основании последних сведений о его передаче */
    private getKeyTagStatusByLastTransfer(keyTagTransfers: KeyTagTransferFull[]): KeyTagStatusEnum {
        const lastKeyTransfer = hasItems(keyTagTransfers)
            ? keyTagTransfers[keyTagTransfers.length - 1]
            : null;
        // если КБ помечен "на хранение" и есть дата получения, или если КБ новый (нет передач)
        if (!lastKeyTransfer || (lastKeyTransfer.forStorage && lastKeyTransfer.receiptDateTime)) {
            return KeyTagStatusEnum.inStorage;
        }
        // если еще нет выдавшего (новый КБ), или есть дата получения, но без пометки "на хранение"
        if (!lastKeyTransfer.issuerEmployee || (lastKeyTransfer.issuerEmployee && lastKeyTransfer.receiptDateTime)) {
            return KeyTagStatusEnum.inStock;
        }
        // если есть выдавший, но еще нет даты получения
        return KeyTagStatusEnum.inTransmission;
    }

    private getKeyTagIsFromStorage(keyTag: KeyTagTableItem): boolean {
        return hasItems(keyTag.keyTagTransfers)
        && keyTag.keyTagTransfers.length > 1
            ? keyTag.keyTagTransfers[keyTag.keyTagTransfers.length - 2].forStorage
            : false;
    }

    /** Загружает КБ по списку идентификаторов */
    private async getEquipmentKeyTags(equipmentIds: number[]): Promise<KeyTagShort[]> {
        const filters = [new FilterObject("EquipmentId", FilterOperation.IN, equipmentIds.map(id => id.toString()))];
        if (hasValue(this.card.logType)) {
            filters.push(new FilterObject("KeyTagType", FilterOperation.EQ, [this.card.logType.keyTagType.toString()]));
        }
        const result = await this.keyTagApiService.getShortData(filters).toPromise();
        return result.results;
    }


    /**  Возвращает КБ, находящиеся в таблице ключи, не связанные ни с одной единицей оборудования смены */
    private getOrphanKeyTags(): KeyTagShort[] {
        if (!this.currentShift) {
            return [];
        }

        const shiftEquipmentIds = this.equipmentSap ? this.equipmentSap.map(x => x.equipment.id) : [];
        if (this.card.equipment) {
            shiftEquipmentIds.push(this.card.equipment.id);
        }
        let equipmentWithoutSapKeyTagIds = [];
        if (hasItems(this.equipmentWithoutSap)) {
            equipmentWithoutSapKeyTagIds = this.equipmentWithoutSap.filter(e => hasValue(e.keyTag)).map(e => e.keyTag.id);
        }

        if (this.logTypeConstant) {
            const updatedKeyTags = this.currentShift.keyTags.filter(item => shiftEquipmentIds.includes(item.keyTag.equipmentId));
            if (hasItems(equipmentWithoutSapKeyTagIds)) {
                updatedKeyTags.pushRange(this.currentShift.keyTags.filter(k => equipmentWithoutSapKeyTagIds.includes(k.keyTag.id)));
            }
            this.currentShift.keyTags = [...updatedKeyTags];
        } else if (this.logTypePeriodic) {
            let keyTags = [];
            if (hasValue(this.card.equipment)) {
                keyTags.pushRange(this.card.keyTags.filter(kt => kt.keyTag.equipmentId === this.card.equipment.id));
            }

            const lastVersion = this.viewModel.getLastVersion();
            if (lastVersion) {
                const sapEquipmentIds = lastVersion.equipment
                    .filter(se => !!se.equipment)
                    .map(e => e.equipment.id);
                keyTags.pushRange(this.card.keyTags.filter(kt => sapEquipmentIds.some(e => e === kt.keyTag.equipmentId)));

                const noSapEquipmentIds = lastVersion.equipment
                    .filter(se => !se.equipment && !!se.keyTag)
                    .map(e => e.keyTag.id);
                keyTags.pushRange(this.card.keyTags.filter(kt => noSapEquipmentIds.some(e => e === kt.keyTag.id)));
            }

            this.card.keyTags = keyTags;
        }

        let removedKeyTags = this.keyTagTableData.map(k => k.keyTag).filter(item => !shiftEquipmentIds.includes(item.equipmentId));
        this.keyTagTableData = this.keyTagTableData.filter(item => shiftEquipmentIds.includes(item.keyTag.equipmentId)
            || equipmentWithoutSapKeyTagIds.includes(item.keyTag.id));
        return removedKeyTags;
    }

    /** Обновляет КБ смены обновленными записями таблицы КБ */
    private updateKeyTagsWithTableItems(tableItems: KeyTagTableItem[]) {
        tableItems.forEach(tableItem => {
            const updatedKeyTag = new ShiftKeyTagFull();
            updatedKeyTag.keyTag = tableItem.keyTag;
            updatedKeyTag.keyTagTransfers = [...tableItem.keyTagTransfers];

            if (this.logTypeConstant && hasValue(this.currentShift)) {
                if (!hasItems(this.currentShift.keyTags)) {
                    this.currentShift.keyTags = [];
                }
                const itemIndex = this.currentShift.keyTags.findIndex(el => el.keyTag.id === tableItem.keyTag.id);
                if (itemIndex < 0) {
                    this.currentShift.keyTags.push(updatedKeyTag);
                } else {
                    this.currentShift.keyTags[itemIndex] = updatedKeyTag;
                }
            } else if (this.logTypePeriodic) {
                if (!hasItems(this.card.keyTags)) {
                    this.card.keyTags = [];
                }
                const itemIndex = this.card.keyTags.findIndex(el => el.keyTag.id === tableItem.keyTag.id);
                if (itemIndex < 0) {
                    this.card.keyTags.push(updatedKeyTag);
                } else {
                    this.card.keyTags[itemIndex].keyTagTransfers = updatedKeyTag.keyTagTransfers;
                }
            }
        });

        if (this.isViewDisabled) {
            let keyTagsToSave = [];
            let shiftId: number = null;
            if (this.logTypeConstant && this.currentShift) {
                keyTagsToSave = this.currentShift.keyTags.map(item => new ShiftKeyTagSave(item));
                shiftId = this.currentShift.id;
            }
            if (this.logTypePeriodic) {
                keyTagsToSave = this.card.keyTags.map(item => new ShiftKeyTagSave(item));
            }
            this.shiftLogCardApiService.updateShiftKeyTags(this.card.id, shiftId, keyTagsToSave)
                .subscribe(() => {});
        } else {
            this.markAsDirty();
        }
    }

    /** Проверяет доступность редактирования в зависимости от состояния смены */
    get hasEditPermissionStateShift(): boolean {
        if (this.isCurrentShiftOpen()) {
            return this.hasFullEditPermission || this.hasEditPermissionAsResponsible || this.hasFixPermission;
        } else {
            return this.hasEditClosedShiftPermission;
        }
    }

    /** Получение и передача КБ недоступна. */
    get isKeyTagTransferDisabled(): boolean {
        if (this.isViewDisabled || this.isInactualLog) {
            return true;
        }
        if (this.logTypeConstant) {
            return !this.isCurrentShiftOpen() || !this.hasEditPermissionStateShift;
        }
        if (this.logTypePeriodic) {
            // Для периодического журнала возможно, только если нет открытых смен.
            const hasOpenShifts = hasItems(this.card.shifts) && this.card.shifts.some(s => this.shiftIsOpen(s));
            const hasNoRights = !(this.hasFullEditPermission || this.hasEditPermissionAsResponsible || this.hasFixPermission);
            const notCurrentDateSelected = !this.formatter.areSameDay(new Date(), this.viewModel.selectedShiftDate);
            return hasOpenShifts || hasNoRights || notCurrentDateSelected;
        }
        return false;
    }

    /** Наличие КБ, доступных для операции "Исправить ошибку в передаче" */
    get hasKeyTagsForCorrection() {
        const availableKeyTags = this.selectKeyTagsToCorrect();
        return hasItems(availableKeyTags);
    }

    /** Выбирает из таблицы КБ, доступные для операции "Получить" */
    private selectKeyTagsToReceive(): KeyTagTableItem[] {
        const keyTagsIssuedToCurrentEmployee = this.keyTagTableData.filter(tableItem => {
            const userIsResponsibleForKeyTag = this.currentUserIsResponsibleForKeyTagIssuance(tableItem);
            const userIsKeyTagRecipient = this.currentUserIsKeyTagRecipient(tableItem);
            const keyTagIsInTransmission = tableItem.status === KeyTagStatusEnum.inTransmission;
            const lastKeyTransfer = this.getLastKeyTagTransfer(tableItem);
            const isReceiverEmployee = lastKeyTransfer && lastKeyTransfer.receiverEmployee.id === this.userEmployee.id;
            return (keyTagIsInTransmission && isReceiverEmployee)
                && (userIsResponsibleForKeyTag || userIsKeyTagRecipient);
        });
        return keyTagsIssuedToCurrentEmployee;
    }

    /** Выбирает из таблицы КБ, доступные для операции "Передать" */
    private selectKeyTagsToIssue(): KeyTagTableItem[] {
        const itemsToIssue = this.keyTagTableData
            .filter(tableItem => {
                const userIsResponsibleForKeyTag = this.currentUserIsResponsibleForKeyTagIssuance(tableItem);
                const userIsKeyTagRecipient = this.currentUserIsKeyTagRecipient(tableItem);
                const lastKeyTransfer = this.getLastKeyTagTransfer(tableItem);
                const userIsOwner = !lastKeyTransfer
                    || (lastKeyTransfer.receiverEmployee
                    && lastKeyTransfer.receiverEmployee.id === this.userEmployee.id);
                const keyTagInStock = tableItem.status === KeyTagStatusEnum.inStock
                    && (userIsResponsibleForKeyTag || userIsKeyTagRecipient)
                    && userIsOwner;
                const keyTagInStorage = tableItem.status === KeyTagStatusEnum.inStorage
                    && userIsResponsibleForKeyTag;
                return keyTagInStock || keyTagInStorage;
            });
        return itemsToIssue;
    }

    /** Выбирает из таблицы КБ, доступные для операции "Исправить ошибку в передаче" */
    private selectKeyTagsToCorrect(): KeyTagTableItem[] {
        const availableKeyTags = this.keyTagTableData.filter(tableItem => {
            const keyTagIsInTransmission = tableItem.status === KeyTagStatusEnum.inTransmission;
            const userIsResponsibleForKeyTag = this.currentUserIsResponsibleForKeyTagIssuance(tableItem);
            const userIsKeyTagRecipient = this.currentUserIsKeyTagRecipient(tableItem);
            const lastKeyTransfer = this.getLastKeyTagTransfer(tableItem);
            const userIsIssuer = lastKeyTransfer && lastKeyTransfer.issuerEmployee && lastKeyTransfer.issuerEmployee.id === this.userEmployee.id;
            const isForStorage = lastKeyTransfer && lastKeyTransfer.forStorage;
            return keyTagIsInTransmission
                && (userIsIssuer || (isForStorage && userIsResponsibleForKeyTag) || (!isForStorage && userIsKeyTagRecipient));
        });
        return availableKeyTags;
    }

    /** Логика после установки нового значения смены. */
    private onShiftSet(shift: ShiftFull) {
        if (this.logTypeConstant) {
            this.fillKeyTagTableFromCurrentShift(shift);
        }
        if (!hasItems(shift.shiftEquipment)) {
            shift.shiftEquipment = [];
        }
        this.equipmentSap = shift.shiftEquipment.filter(eq => !!eq.equipment);
        this.equipmentWithoutSap = shift.shiftEquipment.filter(eq => !eq.equipment);
        if (this.logTypePeriodic) {
            this.fillKeyTagTableForPeriodical();
        }
    }

    /** Тип журнала - постоянный. */
    private get logTypeConstant(): boolean {
        return hasValue(this.card) && hasValue(this.card.logType) && this.card.logType.keyTagType === KeyTagTypeEnum.Constant;
    }

    /** Тип журнала - периодический. */
    private get logTypePeriodic(): boolean {
        return hasValue(this.card) && hasValue(this.card.logType) && this.card.logType.keyTagType === KeyTagTypeEnum.Periodic;
    }

    /** Устанавливает КБ для отображения в случае, если не выбрана текущая смена. */
    private setNoShiftKeyTags() {
        this.keyTagTableData = [];
        if (!this.card) {
            return;
        }
        if (this.logTypePeriodic) {
            this.fillKeyTagTableForPeriodical();
        } else if (this.logTypeConstant) {
            this.fillKeyTagTableForConstant();
        }
    }

    /** Для периодического журнала фильтрует передачи на выбранный день смены. */
    private filterTransfers() {
        if (hasItems(this.keyTagTableData) && this.logTypePeriodic) {
            let date = this.viewModel.selectedShiftDate;
            this.keyTagTableData.forEach(tableItem => {
                let cardKeyTag = this.card.keyTags.find(k => k.keyTag.id === tableItem.keyTag.id);
                if (hasValue(cardKeyTag)) {
                    if (!hasItems(cardKeyTag.keyTagTransfers)) {
                        cardKeyTag.keyTagTransfers = [];
                    }
                    tableItem.keyTagTransfers = cardKeyTag.keyTagTransfers
                        .filter(tr => hasValue(tr.receiptDateTime) && this.formatter.areSameDay(date, tr.receiptDateTime)
                            || hasValue(tr.issueDateTime) && this.formatter.areSameDay(date, tr.issueDateTime));
                    tableItem.status = this.getKeyTagStatusByLastTransfer(tableItem.keyTagTransfers);
                    tableItem.isFromStorage = this.getKeyTagIsFromStorage(tableItem);
                }
            });
        }
        this.refreshTableGridView();
    }

    /**
     * Отфильтровывает ключ-бирки по типу журнала.
     * По бизнесу карту журнала сначала создают, только потом создают смены для нее, потому не стала обрабатывать
     * случай, когда создана карта сразу со сменой или даже с несколькими. В будущем хотят совсем убрать возможность
     * добавлять смену на новой карте.
     * */
    private async filterKeyTagsByLogType() {
        if (!hasValue(this.card.logType)) {
            return;
        }
        let keyTagsToRemove = [];
        let logType = this.card.logType.keyTagType;
        if (logType !== KeyTagTypeEnum.Periodic && hasItems(this.card.keyTags)) {
            let keyTags = [];
            if (hasValue(this.card.equipment)) {
                keyTags.pushRange(this.card.keyTags
                    .filter(kt => kt.keyTag.keyTagType === logType && kt.keyTag.equipmentId === this.card.equipment.id));
            }
            this.card.keyTags = keyTags;
            this.setKeyTagTableData(keyTags);
        } else {
            this.keyTagTableData = this.keyTagTableData.filter(d => d.keyTag.keyTagType === logType);
        }
        if (hasItems(keyTagsToRemove)) {
            this.onEquipmentRemoveKeyTags.emit(keyTagsToRemove);
        }
    }

    /**
     * Делает проверку, находятся ли все КБ периодического журнала в состоянии "Получен".
     * */
    private checkAllKeyTagsAccepted() {
        if (!this.logTypePeriodic || !hasItems(this.keyTagTableData)) {
            return;
        }
        const allAccepted = this.keyTagTableData.every(tableItem => {
            const lastKeyTransfer = hasItems(tableItem.keyTagTransfers)
                ? tableItem.keyTagTransfers[tableItem.keyTagTransfers.length - 1]
                : null;
            return lastKeyTransfer
                && lastKeyTransfer.receiverEmployee && lastKeyTransfer.receiptDateTime
                && !lastKeyTransfer.forStorage;
        });
        this.acceptKeyTagsSubject.next(allAccepted);
    }

    /**
     * Возвращает последнюю по времени запись о передаче КБ.
     * */
    private getLastKeyTagTransfer(keyTagTableItem: KeyTagTableItem) {
        return hasItems(keyTagTableItem.keyTagTransfers)
            ? keyTagTableItem.keyTagTransfers[keyTagTableItem.keyTagTransfers.length - 1]
            : null;
    }

    /**
     * Проверяет, входит ли текущий пользователь в список "Получатели КБ".
     * */
    private currentUserIsKeyTagRecipient(keyTagTableItem: KeyTagTableItem) {
        return keyTagTableItem.keyTag.recipientIds.includes(this.userEmployee.id);
    }

    /**
     * Проверяет, входит ли текущий пользователь в список "Ответственные за выдачу КБ".
     * */
    private currentUserIsResponsibleForKeyTagIssuance(keyTagTableItem: KeyTagTableItem) {
        return keyTagTableItem.keyTag.responsibleForIssuanceIds.includes(this.userEmployee.id);
    }
}
