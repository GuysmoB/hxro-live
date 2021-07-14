import { UtilsService } from './utils-service';
import { CandleAbstract } from '../abstract/candleAbstract';


export class IndicatorsService extends CandleAbstract {

  constructor(private utils: UtilsService) {
    super();
  }

  atr(data: any, window): any {
    const tr = this.trueRange(data);
    return this.ema(tr, 2 * window - 1);
  }

  trueRange(data: any): any {
    const tr = [data[0].high - data[0].low];
    for (let i = 1, len = data.length; i < len; i++) {
      tr.push(Math.max(data[i].high - data[i].low, Math.abs(data[i].high - data[i - 1].close), Math.abs(data[i].low - data[i - 1].close)));
    }
    return tr;
  }

  sma(data: any, index: number, periode: number): number {
    const result = [];
    const dataStart = index - periode;

    if (dataStart > 0) {
      for (let i = dataStart; i < index; i++) {
        result.push(data[i].close);
      }
      return this.utils.round(result.reduce((a, b) => a + b, 0) / result.length, 5);
    } else {
      return 0;
    }
  }

  smaRsi(data: any, index: number, periode: number): number {
    const result = [];
    const dataStart = index - periode;

    if (dataStart > 0) {
      for (let i = dataStart; i < index; i++) {
        result.push(data[i]);
      }
      return this.utils.round(result.reduce((a, b) => a + b, 0) / result.length, 5);
    } else {
      return 0;
    }
  }

  mean(series: Array<number>): any {
    let sum = 0;
    for (let i = 0; i < series.length; i++) {
      sum += series[i];
    }
    return sum / series.length;
  }

  ema(series: Array<number>, window: number, start?: number): any {
    const weight = 2 / (window + 1);
    const ema = [start ? start : this.mean(series.slice(0, window))];
    for (let i = 1, len = series.length; i < len; i++) {
      ema.push(series[i] * weight + (1 - weight) * ema[i - 1]);
    }
    return ema;
  }

  pointwise(operation: Function, ...serieses: Array<Array<number>>): any {
    const result = [];
    for (let i = 0, len = serieses[0].length; i < len; i++) {
      const iseries = (i: number) => serieses.map(x => x[i]);
      result[i] = operation(...iseries(i));
    }
    return result;
  }

  rsi(candlesticks: any, window: number): any {
    const $close = [];
    for (let j = 0; j < candlesticks.length; j++) {
      $close.push(candlesticks[j].close);
    }

    const gains = [0];
    const loss = [1e-14];
    for (let i = 1, len = $close.length; i < len; i++) {
      const diff = $close[i] - $close[i - 1];
      gains.push(diff >= 0 ? diff : 0);
      loss.push(diff < 0 ? -diff : 0);
    }
    const emaGains = this.ema(gains, 2 * window - 1);
    const emaLoss = this.ema(loss, 2 * window - 1);
    return this.pointwise((a: number, b: number) => 100 - 100 / (1 + a / b), this.ema(gains, 2 * window - 1), this.ema(loss, 2 * window - 1));
  }

  crossNumber(data: any, maData: any, periode: number): number {
    let nbCross = 0;

    if (maData.length > periode) {
      for (let i = (maData.length - periode); i < maData.length; i++) {
        const maPrice = maData[i];

        if (maPrice) {
          const crossDown = this.close(data, i, 1) > maPrice && this.close(data, i, 0) < maPrice;
          const crossUp = this.close(data, i, 1) < maPrice && this.close(data, i, 0) > maPrice;

          if (crossUp || crossDown) {
            nbCross++;
          }
        }
      }
    }


    return nbCross;
  }
}
