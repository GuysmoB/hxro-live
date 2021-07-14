export abstract class CandleAbstract {

    logEnable = true;

    constructor() { }

    isUp(data: any, index: number, lookback: number): boolean {
        return (data[index - lookback].close > data[index - lookback].open);
    }

    open(data: any, index: number, lookback: number): number {
        return data[index - lookback].open;
    }

    close(data: any, index: number, lookback: number): number {
        return data[index - lookback].close;
    }

    high(data: any, index: number, lookback: number): number {
        return data[index - lookback].high;
    }

    low(data: any, index: number, lookback: number): number {
        return data[index - lookback].low;
    }

    date(data: any, index: number, lookback: number): string {
        return data[index - lookback].date;
    }
}