import { CandleAbstract } from "../abstract/candleAbstract";
import { UtilsService } from "./utils-service";

export class StrategiesService extends CandleAbstract {

  lookback: number;
  rsiMax: number;
  rsiMin: number;

  constructor(private utils: UtilsService) {
    super();
  }

  /**
   * Applique la strat en fonction du ticker
   */
  setStratToTicker(ticker: string) {
    this.lookback = 2;
    if (ticker === 'BTC') {
      this.rsiMax = this.rsiMin = 50;
    } else if (ticker === 'ETH') {
      this.rsiMax = 60;
      this.rsiMin = 40;
    }

    if (this.rsiMin == undefined || this.rsiMax == undefined) {
      this.utils.stopProcess('Undefined strat parameters');
    }
  }


  /**
   * Strat bulish
   */
  bullStrategy(haOhlc: any, i: number, rsiValues: any, rartio1: any): any {
    let cond = true;
    for (let j = (i - 1); j >= (i - this.lookback); j--) {
      const ha = haOhlc[j];
      if (ha.bull) {
        cond = false;
        break;
      }
    }

    if (cond && haOhlc[i].bull && rartio1 > 15) {
      console.log('Entry long setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }


  /**
   * Strat bearish
   */
  bearStrategy(haOhlc: any, i: number, rsiValues: any, ratio1: any): any {
    let cond = true;
    for (let j = (i - 1); j >= (i - this.lookback); j--) {
      const ha = haOhlc[j];
      if (ha.bear) {
        cond = false;
        break;
      }
    }

    if (cond && haOhlc[i].bear && ratio1 < -15) {
      console.log('Entry short setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }
}

export default new StrategiesService(new UtilsService());
