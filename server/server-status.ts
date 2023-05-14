import prettyBytes from "pretty-bytes";


export interface ServerStatusTable {
    columns: string[];
    rows: any[][];
}

export interface ServerStatusReport {
    name: string;
    get(): ServerStatusTable;
}

export interface Status {
    name: string;
    table: ServerStatusTable;
}

export default class ServerStatus {

    private static readonly reports = new Set<ServerStatusReport>();

    public static publish(report: ServerStatusReport) {
        this.reports.add(report);
    }

    public static get(): Status[] {
        return Array.from(this.reports.values()).map((report) => ({
            name: report.name,
            table: report.get()
        }));
    }

    private constructor() { void 0 }
}

ServerStatus.publish({
    name: 'Node memory',
    get() {
        const m = process.memoryUsage();
        return {
            columns: ['rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers'],
            rows: [[
                prettyBytes(m.rss),
                prettyBytes(m.heapTotal),
                prettyBytes(m.heapUsed),
                prettyBytes(m.external),
                prettyBytes(m.arrayBuffers)
            ]]
        };
    }
});
