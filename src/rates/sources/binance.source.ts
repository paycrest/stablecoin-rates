import { HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { calculateMedian } from 'src/common';
import { StableCoin } from '../dto/get-rates.dto';
import { Source } from './source';

export class Binance extends Source<'binance'> {
  sourceName = 'binance' as const;
  stablecoins: StableCoin[] = ['USDT', 'USDC'];

  private getEndpoint = () =>
    'https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search';

  async fetchData(fiat: string) {
    const pairs = this.stablecoins.map((stablecoin) => ({
      rows: 20,
      page: 1,
      tradeType: 'SELL',
      fiat,
      asset: stablecoin,
    }));
    const url = this.getEndpoint();

    const responses = await axios.all(
      pairs.map((data) =>
        axios.request({
          method: 'POST',
          url,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'insomnia/10.3.1',
          },
          data,
        }),
      ),
    );

    const prices = [];

    for (const response of responses) {
      if (response.status === HttpStatus.OK && response.data) {
        const ticker: {
          code: string;
          message?: string;
          messageDetail?: string;
          data: {
            adv: {
              advNo: string;
              classify: string;
              tradeType: string;
              asset: string;
              fiatUnit: string;
              advStatus?: string;
              priceType?: string;
              priceFloatingRatio?: number;
              rateFloatingRatio?: number;
              currencyRate?: number;
              price: string;
              initAmount?: string;
              surplusAmount: string;
              tradableQuantity: string;
              amountAfterEditing?: string;
              maxSingleTransAmount: string;
              minSingleTransAmount: string;
              buyerKycLimit?: number;
              buyerRegDaysLimit?: number;
              buyerBtcPositionLimit?: number;
              remarks?: string;
              autoReplyMsg?: string;
              payTimeLimit: number;
              tradeMethods: {
                payId?: string;
                payMethodId: string;
                payType: string;
                payAccount?: string;
                payBank?: string;
                paySubBank?: string;
                identifier: string;
                iconUrlColor?: string;
                tradeMethodName: string;
                tradeMethodShortName?: string;
                tradeMethodBgColor: string;
              }[];
              userTradeCountFilterTime?: string;
              userBuyTradeCountMin?: number;
              userBuyTradeCountMax?: number;
              userSellTradeCountMin?: number;
              userSellTradeCountMax?: number;
              userAllTradeCountMin?: number;
              userAllTradeCountMax?: number;
              userTradeCompleteRateFilterTime?: string;
              userTradeCompleteCountMin?: number;
              userTradeCompleteRateMin?: number;
              userTradeVolumeFilterTime?: string;
              userTradeType?: string;
              userTradeVolumeMin?: string;
              userTradeVolumeMax?: string;
              userTradeVolumeAsset?: string;
              createTime?: string;
              advUpdateTime?: string;
              fiatVo: any;
              assetVo: any;
              advVisibleRet: any;
              takerAdditionalKycRequired: number;
              minFiatAmountForAdditionalKyc?: string;
              inventoryType?: string;
              offlineReason?: string;
              assetLogo?: string;
              assetScale: number;
              fiatScale: number;
              priceScale: number;
              fiatSymbol: string;
              isTradable: boolean;
              dynamicMaxSingleTransAmount: string;
              minSingleTransQuantity: string;
              maxSingleTransQuantity: string;
              dynamicMaxSingleTransQuantity: string;
              commissionRate: string;
              takerCommissionRate?: string;
              minTakerFee?: string;
              tradeMethodCommissionRates: any;
              launchCountry?: string;
              abnormalStatusList: any;
              closeReason?: string;
              storeInformation: any;
              allowTradeMerchant: any;
              adTradeInstructionTagInfoRets: any;
              isSafePayment: boolean;
              adAdditionalKycVerifyItems: any;
              nonTradableRegions: any;
            };
            advertiser: {
              userNo: string;
              realName?: string;
              nickName: string;
              margin?: number;
              marginUnit?: string;
              orderCount?: number;
              monthOrderCount: number;
              monthFinishRate: number;
              positiveRate: number;
              advConfirmTime?: string;
              email?: string;
              registrationTime?: string;
              mobile?: string;
              userType: string;
              tagIconUrls: string[];
              userGrade: number;
              userIdentity: string;
              proMerchant?: boolean;
              badges: string[];
              vipLevel: number;
              isBlocked: boolean;
              activeTimeInSecond: number;
            };
          }[];
          total: number;
          success: boolean;
        } = response.data;

        if (ticker.success === true) {
          const adPrices = [];
          let stablecoin = '';
          for (const ad of ticker.data) {
            stablecoin = ad.adv.asset.toLowerCase();
            const price = parseFloat(ad.adv.price);
            adPrices.push(price);
          }

          // Calculate the median
          const median = calculateMedian(adPrices);

          prices.push({
            fiat,
            stablecoin,
            rate: parseFloat(median.toFixed(2)),
            source: this.sourceName,
          });
        }
      }
    }

    return this.logData(prices);
  }
}
