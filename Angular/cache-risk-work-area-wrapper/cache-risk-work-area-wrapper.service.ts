import {BaseDictionary} from "../../../infrastructure/sharedMembers/classes/baseModels/base-dictionary.model";
import {CacheDictionaryWrapperService} from "../../../infrastructure/global/contracts/cache-dictionary-wrapper.service";
import {Injectable} from "@angular/core";
import {TranslateService} from "@ngx-translate/core";
import {NetworkStatusService} from "../../../infrastructure/global/services/network-status.service";
import {FilterObjectFactory} from "../../../infrastructure/global/components/filters/filter-object-factory";
import {Formatter} from "../../../infrastructure/sharedMembers/classes/staff/formatter";
import {DexieTables} from "../../../shared/indexed-db/dexie-tables.enum";
import {Observable} from "rxjs";
import {RiskWorkAreasFull} from "../../models/work-areas/work-areas-full";
import {RiskWorkAreaApiservice} from "../risk-work-area.apiservice";
import {DbRiskWorkAreaRepository} from "../../db/db-risk-work-area.repository";
import { FilterObject } from "../../../infrastructure/sharedMembers/classes/filter-object";
import { FilterOperation } from "../../../infrastructure/sharedMembers/classes/filter-operation.enum";
import { CacheLoadingParamsProvider } from "../../../administration/services/cache/cache-loading-params-provider";
import { CancellablePromise } from "../../../infrastructure/global/contracts/dictionary.decorators";
import { FilterObjectConverter } from "../../../infrastructure/sharedMembers/classes/filter-object-converter";
import { sortByStringProp } from "../../../infrastructure/global/services/sort-function";

/** Кешированный сервис справочника Рабочие зоны. */
@Injectable()
export class CacheRiskWorkAreaWrapperService extends CacheDictionaryWrapperService<RiskWorkAreasFull,
    RiskWorkAreasFull,
    RiskWorkAreasFull,
    BaseDictionary,
    BaseDictionary, RiskWorkAreasFull> {

    /**
     * ID предприятий, по которым будут загружаться данные справочника.
     * */
    businessUnitIds: string[] = [];

    constructor(
        protected dictionaryService: RiskWorkAreaApiservice,
        protected dbRepository: DbRiskWorkAreaRepository,
        protected translate: TranslateService,
        private readonly cacheLoadingParamsProvider: CacheLoadingParamsProvider,
        protected networkStatusService: NetworkStatusService,
        protected filterObjectFactory: FilterObjectFactory,
        protected formatter: Formatter
    ) {
        super(
            dictionaryService,
            dbRepository,
            networkStatusService,
            DexieTables.WorkAreas,
            filterObjectFactory,
            formatter
        );
        this.subscriptions.push(
            cacheLoadingParamsProvider.businessUnitIds$.subscribe(ids => this.businessUnitIds = ids)
        );
    }

    /** @inheritDoc */
    getDictionaryCode(): string {
        return "Risk_WorkAreas";
    }

    /** @inheritDoc */
    getDictionaryTitle(): string {
        return this.translate.instant("INFRASTRUCTURE.CACHE_NAMES.WORK_AREAS");
    }

    /** @inheritDoc */
    getInitialDictionary(): Observable<RiskWorkAreasFull[]> {
        return this.dictionaryService.getDictionaryFull();
    }

    /** @inheritDoc */
    async initDataToPrepareOffline(): Promise<boolean> {

        localStorage.setItem(this.statusIdent, "initNow");
        try {
            await this.dbRepository.deleteAll();
            const filters: FilterObject[] = [];
            filters.push(this.filterObjectFactory.getObject("BusinessUnitId", FilterOperation.IN, this.businessUnitIds));
            let items = await this.dictionaryService.getFilteredWorkAreasFull(filters).toPromise();
            let addedKeys = await this.dbRepository.bulkInsert(items);
            if (addedKeys.length === items.length) {
                localStorage.setItem(this.statusIdent, "ok");
                return true;
            } else {
                localStorage.setItem(this.statusIdent, "initError");
                return false;
            }
        } catch (e) {
            localStorage.setItem(this.statusIdent, "initError");
            return false;
        }
    }

    /** @inheritDoc */
    async tryToUpdateDataInOffline(date: Date): Promise<boolean> {
        try {
            localStorage.setItem(this.statusIdent, "updateNow");
            const dateFilter = this.filterObjectFactory.getObject("date", FilterOperation.GT,
                [this.formatter.getTransferDateYYYYMMDDHHmmss( date)]);
            const buFilter = this.filterObjectFactory.getObject("BusinessUnitIds", FilterOperation.CC, this.businessUnitIds);
            const query = this.dictionaryService.getChanges([dateFilter, buFilter]);
            let queryResult = await query.toPromise();
            for (const key of queryResult.deleteValuesIds) {
                await this.dbRepository.deleteByKey(key);
            }
            for (const value of queryResult.addOrUpdateValues) {
                await this.dbRepository.deleteByKey(value.id);
            }
            for (const value of queryResult.addOrUpdateValues) {
                await this.dbRepository.save(value);
            }
            localStorage.setItem(this.statusIdent, "ok");
            return true;
        } catch (e) {
            localStorage.setItem(this.statusIdent, "updateError");
            localStorage.setItem(this.errorIdent, e.message);
            return false;
        }
    }

    /** @inheritDoc */
    convertToFull(syncDto: RiskWorkAreasFull): RiskWorkAreasFull {
        return syncDto;
    }

    /** @inheritDoc */
    convertToShort(syncDto: RiskWorkAreasFull): BaseDictionary {
        const short = new BaseDictionary();
        short.id = syncDto.id;
        short.name = syncDto.name;
        short.lastModificationDateTime = syncDto.lastModificationDateTime;
        short.additionalInfo = syncDto.additionalInfo;
        return short;
    }

    /**
     * Возвращает отфильтрованные записи с сокращенной информацией.
     * @param filterObjects - объекты фильтрации.
     * */
    @CancellablePromise()
    async getDictionaryShortAsync(filterObjects?: FilterObject[]): Promise<BaseDictionary[]> {
        if (this.networkStatusService.isOffline) {
            const dbFilters = FilterObjectConverter.convertFiltersToIndexedDBFilters(filterObjects);
            let filteredData = await this.dbRepository.filter(dbFilters);
            filteredData = sortByStringProp(filteredData);
            return filteredData
                .map(d => this.convertToShort(d));
        }

        return this.dictionaryService.getDictionaryShortAsync(filterObjects);
    }
}
