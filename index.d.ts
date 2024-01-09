import * as electric_sql_client_model from 'electric-sql/client/model';
import { ElectricConfig } from 'electric-sql/config';

interface InitElectricParams {
    appName: string;
    sqliteWasmPath: string;
    schema: any;
    config: ElectricConfig;
}
declare function setLoggedOut(): void;
declare function initElectric(params: InitElectricParams): Promise<electric_sql_client_model.ElectricClient<any>>;
interface ElectricWithDb {
    db: any;
}
type ShapeFunction<Electric extends ElectricWithDb> = (params: {
    db: Electric[`db`];
}) => Array<{
    shape: Promise<any>;
    isReady: () => Promise<boolean>;
}>;
type QueriesRecord<Electric extends ElectricWithDb> = (params: {
    db: Electric[`db`];
} & {
    [key: string]: any;
}) => Record<string, QueryFunction>;
type QueryFunction = () => Promise<any>;
declare function electricSqlLoader<Electric extends ElectricWithDb>({ key, shapes, queries, }: {
    key: string;
    shapes: ShapeFunction<Electric>;
    queries: QueriesRecord<Electric>;
}): Promise<void>;
declare function useElectricData(key: string): any;

export { electricSqlLoader, initElectric, setLoggedOut, useElectricData };
