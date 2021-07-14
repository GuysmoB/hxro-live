import { IndicatorsService } from './services/indicators.service';
import { UtilsService } from './services/utils.service';
import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  data = [];
  haData = [];
  inLong = false;
  inShort = false;
  allTrades = [];
  winTrades = [];
  loseTrades = [];
  looseInc = 0;
  looseInc2 = 0;
  dataSourceRisk: any;
  dataSourceCandle: any;
  displayChart = true;


  constructor(private http: HttpClient, private utils: UtilsService, private indicatorsService: IndicatorsService) { }

  async ngOnInit() {
    this.data = await this.getDataFromApi();
    this.haData = this.utils.setHeikenAshiData(this.data);
    console.log('data', JSON.stringify(this.data))
    const rsiValues = this.indicatorsService.rsi(this.data, 14);

    for (let i = 10; i < this.data.length; i++) {

      if (this.inLong) {
        if (this.isUp(this.data, i, 0)) {
          this.allTrades.push(this.utils.addFees(0.91));
          this.winTrades.push(this.utils.addFees(0.91));
          console.log('Resultat ++', this.utils.round(this.utils.arraySum(this.allTrades), 2), this.utils.getDate(this.data[i].time));
          this.looseInc = 0;
        } else {
          this.allTrades.push(-1);
          this.loseTrades.push(-1);
          console.log('Resultat --', this.utils.round(this.utils.arraySum(this.allTrades), 2), this.utils.getDate(this.data[i].time));
          this.looseInc++;
        }

        if (this.stopConditions(i)) {
          this.inLong = false;
          this.looseInc = 0;
          console.log('Exit bull loose streak', this.utils.getDate(this.data[i].time));
        } else if (this.haData[i].close < this.haData[i].open) {
          this.inLong = false;
          this.looseInc = 0;
          console.log('Exit bull setup', this.utils.getDate(this.data[i].time));
        }
      }


      if (this.inShort) {
        if (!this.isUp(this.data, i, 0)) {
          this.allTrades.push(this.utils.addFees(0.91));
          this.winTrades.push(this.utils.addFees(0.91));
          console.log('Resultat ++', this.utils.round(this.utils.arraySum(this.allTrades), 2), this.utils.getDate(this.data[i].time));
          this.looseInc2 = 0;
        } else {
          this.allTrades.push(-1);
          this.loseTrades.push(-1);
          console.log('Resultat --', this.utils.round(this.utils.arraySum(this.allTrades), 2), this.utils.getDate(this.data[i].time));
          this.looseInc2++;
        }

        if (this.stopConditions(i)) {
          this.inShort = false;
          this.looseInc2 = 0;
          console.log('Exit short loose streak', this.utils.getDate(this.data[i].time));
        } else if (this.haData[i].close > this.haData[i].open) {
          this.inShort = false;
          this.looseInc2 = 0;
          console.log('Exit short setup', this.utils.getDate(this.data[i].time));
        }
      }

      const lookback = 6;
      if (this.bullStrategy(this.haData, this.data, i, lookback, rsiValues)) {
        this.inLong = true;
      } else if (this.bearStrategy(this.haData, this.data, i, lookback, rsiValues)) {
        this.inShort = true;
      }
    }

    console.log('-------------');
    console.log('Trades : Gagnes / Perdus / Total', this.winTrades.length, this.loseTrades.length, this.winTrades.length + this.loseTrades.length);
    console.log('Total R:R', this.utils.round(this.loseTrades.reduce((a, b) => a + b, 0) + this.winTrades.reduce((a, b) => a + b, 0), 2));
    console.log('Avg R:R', this.utils.round(this.allTrades.reduce((a, b) => a + b, 0) / this.allTrades.length, 2));
    console.log('Winrate ' + this.utils.round((this.winTrades.length / (this.loseTrades.length + this.winTrades.length)) * 100, 2) + '%');
  }


  getDataFromApi(): Promise<any> {
    return new Promise<void>((resolve, reject) => {
      this.http.get("https://btc.history.hxro.io/1m").subscribe(
        (res: any) => {
          resolve(res.data);
        },
        (error) => {
          console.log(error);
          reject(error);
        })
    })
  }


  stopConditions(i: number): boolean {
    return (
      this.looseInc == 5 ||
      Math.abs(this.high(this.data, i, 0) - this.low(this.data, i, 0)) > 80
    ) ? true : false;
  }




  bullStrategy(haData: any, data: any, i: number, lookback: number, rsiValues: any): any {
    let cond = true;
    for (let j = (i - 1); j >= (i - lookback); j--) {
      const ha = haData[j];
      if (ha.close > ha.open) { // if bull
        cond = false;
        break;
      }
    }

    if (cond && haData[i].close > haData[i].open && rsiValues[i] < 40) {
      console.log('Entry bull setup', this.utils.getDate(data[i].time));
      return true;
    } else {
      return false;
    }
  }


  bearStrategy(haData: any, data: any, i: number, lookback: number, rsiValues: any): any {
    let cond = true;
    for (let j = (i - 1); j >= (i - lookback); j--) {
      const ha = haData[j];
      if (ha.close < ha.open) { // if bear
        cond = false;
        break;
      }
    }

    if (cond && haData[i].close < haData[i].open && rsiValues[i] > 60) {
      console.log('Entry bear setup', this.utils.getDate(data[i].time));
      return true;
    } else {
      return false;
    }
  }


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
}
