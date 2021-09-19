import { CandleAbstract } from "../abstract/candleAbstract";
import { UtilsService } from "./utils-service";

export class StrategiesService extends CandleAbstract {

  constructor(private utils: UtilsService) {
    super();
  }


  bullStrategy(i: number, rsiValues: any, ratio): any {
    if (rsiValues[i] < 40 && ratio > 20) {
      console.log('Entry bull setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }


  bearStrategy(i: number, rsiValues: any, ratio): any {
    if (rsiValues[i] > 60 && ratio < -20) {
      console.log('Entry bear setup', this.utils.getDate());
      return true;
    } else {
      return false;
    }
  }
}

export default new StrategiesService(new UtilsService());
