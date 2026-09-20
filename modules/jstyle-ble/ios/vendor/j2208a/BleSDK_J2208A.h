//
//  BleSDK.h
//  BleSDK
//
//  Created by yang sai on 2022/4/27.
//

#import <Foundation/Foundation.h>
#import "BleSDK_Header_J2208A.h"
#import "DeviceData_J2208A.h"
@interface BleSDK_J2208A : NSObject
/*!
 *  @method sharedManager:
 *
 *  @discussion Singleton pattern 单例模式
 *
 */
+(BleSDK_J2208A *)sharedManager;

/*!
 *  @method GetDeviceTime:
 *
 *  @discussion Get the time of the watch  获取手表的时间
 *
 */
-(NSMutableData*)GetDeviceTime;
/*!
 *  @method SetDeviceTime:
 *  @param deviceTime   time parameter  时间参数.
 *  @discussion Set the time of the watch 设置手表的时间
 *
 */
-(NSMutableData*)SetDeviceTime:(MyDeviceTime_J2208A)deviceTime;

/*!
 *  @method GetPersonalInfo:
 *
 *  @discussion Get the personal information of the watch  获取手表的个人信息
 *
 */
-(NSMutableData*)GetPersonalInfo;
/*!
 *  @method SetPersonalInfo:
 *  @param personalInfo   Personal basic information parameters   个人基本信息参数
 *  @discussion Set up your watch's personal information  设置手表的个人信息
 *
 */
-(NSMutableData*)SetPersonalInfo:(MyPersonalInfo_J2208A)personalInfo;


/*!
 *  @method GetDeviceInfo:
 *
 *  @discussion Get basic information about your watch 获取手表的基本信息
 *
 */
-(NSMutableData*)GetDeviceInfo;

/*!
 *  @method SetDeviceInfo:
 *  @param deviceInfo   Basic information parameters of the watch 手环的基本信息参数
 *  @discussion Set the basic information parameters of the watch 设置手表的基本信息参数
 *
 */
-(NSMutableData*)SetDeviceInfo:(MyDeviceInfo_J2208A)deviceInfo;




/*!
 *  @method SetDeviceID:
 *  @param strDeviceID   ID   6 bytes, less than 6 bytes will be automatically filled with 0. Numbers 0 to 9 and English letters a to f    6个字节,不足6个字节就会自动补0.数字0到9 和英文字母a到f
 *  @discussion Set watch ID 设置手表ID
 *
 */
-(NSMutableData*)SetDeviceID:(NSString*)strDeviceID;


/*!
 *  @method GetStepGoal
 *
 *  @discussion Get your watch's step goal 获取手表的步数目标
 *
 */
-(NSMutableData*)GetStepGoal;
/*!
 *  @method SetStepGoal:
 *  @param stepGoal    target value of steps 步数的目标值.
 *  @discussion Set a step goal  设置步数目标
 *
 */
-(NSMutableData*)SetStepGoal:(int)stepGoal;







/*!
 *  @method GetDeviceBatteryLevel
 *
 *  @discussion Get the battery of the watch  获取手表的电量
 *
 */
-(NSMutableData*)GetDeviceBatteryLevel;


/*!
 *  @method GetDeviceMacAddress
 *
 *  @discussion Get the Mac address of the watch  获取手表的Mac地址
 *
 */
-(NSMutableData*)GetDeviceMacAddress;



/*!
 *  @method GetDeviceVersion
 *
 *  @discussion  Get the version information of the watch 获取手表的版本信息
 *
 */
-(NSMutableData*)GetDeviceVersion;



/*!
 *  @method Reset
 *
 *  @discussion  Factory reset (factory reset will delete all data on the device) 恢复出厂设置(恢复出厂设置会让设备的数据全部删除)
 *
 */
-(NSMutableData*)Reset;

/*!
 *  @method MCUReset
 *
 *  @discussion MCU reset, restarting the device, will not delete the data stored in the watch    MCU复位，重启设备，不会删除手表存储的数据
 *
 */
-(NSMutableData*)MCUReset;

/*!
 *  @method MotorVibrationWithTimes:
 *  @param times  The number of times the motor vibrates (1-5).  马达震动的次数（1-5）.
 *  @discussion motor vibration 马达震动
 *
 */
-(NSMutableData*)MotorVibrationWithTimes:(int)times;



/*!
 *  @method GetDeviceName
 *
 *  @discussion  Get the bluetooth name of the watch, this method is invalid in devices that cannot change the bluetooth name  获取手表的蓝牙名称，这个方法在不能改变蓝牙名字的设备中是无效的
 *
 */
-(NSMutableData*)GetDeviceName;


/*!
 *  @method SetDeviceName:
 *  @param strDeviceName  Bluetooth name of the device (must be ASCII character code 32 to 127, other data will be treated as spaces) 设备的蓝牙名称（必须为ASCII字符码 32 to 127，发其它数据将被当做空格处理）
 *  @discussion Set the bluetooth name of the watch, this method is invalid in devices that cannot change the bluetooth name  设置手表的蓝牙名称，这个方法在不能改变蓝牙名字的设备中是无效的
 */
-(NSMutableData*)SetDeviceName:(NSString*)strDeviceName;


/*!
 *  @method GetAutomaticMonitoringWithDataType:
 *  @param dataType   1 means heartRate  2 means spo2  3 means temperature  4 means HRV 1 表示心率 2 表示血氧饱和度 3 表示体温 4 表示 HRV
 *  @discussion get  the automatic monitoring information set by the watch
 *
 */
-(NSMutableData*)GetAutomaticMonitoringWithDataType:(int)dataType;

/*!
 *  @method SetAutomaticMonitoring:
 *  @param automaticMonitoring   Automatic measurement setting information of the watch  手表的自动测量设置信息
 *  @discussion Set the automatic measurement setting information of the watch 设置手表的自动测量设置信息
 *
 */
-(NSMutableData*)SetAutomaticHRMonitoring:(MyAutomaticMonitoring_J2208A)automaticMonitoring;


/*!
 *  @method GetAlarmClock:
 *
 *  @discussion get alarm获取闹钟
 *
 */
-(NSMutableData*)GetAlarmClock;



/*!
 *  @method  DeleteAllAlarmClock
 *
 *  @discussion   delete all alarms 删除所有闹钟
 *
 */
-(NSMutableData*)DeleteAllAlarmClock;


/*!
 *  @method SetAlarmClockWithAllClock:
 *  @param arrayClockAlarm   Set all alarm clocks (the maximum number of alarm clocks is 10) The format of each alarm clock is an NSDictionary 设置所有闹钟(闹钟最大的个数是10) 每个闹钟的格式是一个NSDictionary
 *  @discussion Set watch alarm 设置手表闹钟
 *
 */
-(nullable NSMutableArray<NSMutableData *> *)SetAlarmClockWithAllClock:(nullable NSArray<NSDictionary *> *)arrayClockAlarm;

/*!
 *  @method GetSedentaryReminder
 *
 *  @discussion Get sedentary reminder parameters 获取久坐提醒参数
 *
 */
-(NSMutableData*)GetSedentaryReminder;



/*!
 *  @method SetSedentaryReminder:
 *  @param sedentaryReminder   Sedentary reminder parameters  久坐提醒参数
 *  @discussion Set a sedentary reminder  设置久坐提醒
 *
 */
-(NSMutableData*)SetSedentaryReminder:(MySedentaryReminder_J2208A)sedentaryReminder;



/*!
 *  @method StartDeviceMeasurementWithType::::
 *   @param dataType    The type of measurement that needs to be turned on   1 means HRV   2 means HR   3 means Spo2 4 means temperature
 *   @param isOpen   When its value is YES, it means on, otherwise it means off
 *  @discussion  Turn on device measurement
 *
 */

-(NSMutableData*)StartDeviceMeasurementWithType:(int)dataType  isOpen:(BOOL)isOpen;










/*!
 *  @method ppgWithMode::
 *  @param ppgMode  1 表示开启ppg测量   2表示给设备发送测量结果  3表示停止ppg测量  4表示给设备发送ppg测量的进度  5表示退出ppg测量
 *  @param ppgStatus 当 ppgMode=2或者 ppgMode=4的时候才有效。当ppgMode=2时，0表示测量失败  1 表示测量结果偏低  2表示测量结果正常 3表示测量结果偏高 。 当ppgMode=4时，ppgStatus表示测量的进度值，范围是0-100
 *  @discussion Turn on ECG measurement 开启ECG测量
 *
 */
-(NSMutableData*)ppgWithMode:(int)ppgMode  ppgStatus:(int)ppgStatus;



/*!
 *  @method RealTimeDataWithType:
 *  @param dataType   0: means off 1: when the number of steps changes, the watch will upload data (the data does not include the temperature value) 2: upload a data fixed in one second (the data will include the temperature value)    0:表示关闭  1:当步数发生变化时，手表会上传数据（数据不包含温度值） 2:固定一秒钟上传一个数据(数据会包含温度值)
 *
 *  @discussion Watch real-time data upload  实时数据上传
 *
 */
-(NSMutableData*)RealTimeDataWithType:(int8_t)dataType;
















/*!
 *  @method GetTotalActivityDataWithMode::
 *  @param mode   0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50) 0x99: It means to delete all the total exercise data   0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有运动总数据
 *  @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion Get total exercise data    获取运动总数据
 *
 */
-(NSMutableData*)GetTotalActivityDataWithMode:(int)mode withStartDate:(NSDate*)startDate;


/*!
 *  @method GetDetailActivityDataWithMode::
 *  @param mode    0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: Indicates to delete all detailed exercise data          0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有详细运动数据
 *   @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion  Get detailed exercise data   获取详细运动数据
 *
 */
-(NSMutableData*)GetDetailActivityDataWithMode:(int)mode  withStartDate:(NSDate*)startDate;


/*!
 *  @method GetDetailSleepDataWithMode::
 *  @param mode    0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: Indicates to delete all sleep  data    0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有睡眠数据
 *  @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion Get sleep data  获取睡眠数据
 *
 */
-(NSMutableData*)GetDetailSleepDataWithMode:(int)mode  withStartDate:(NSDate*)startDate;



/*!
 *  @method GetContinuousHRDataWithMode::
 *  @param mode   0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: means to delete all continuous HR  data  0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有连续心率数据
 *  @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion Get continuous heart rate data  获取连续心率
 *
 */
-(NSMutableData*)GetContinuousHRDataWithMode:(int)mode  withStartDate:(NSDate*)startDate;

/*!
 *  @method GetSingleHRDataWithMode::
 *  @param mode    0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: means to delete all single HR  data  0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有单次心率数据
 *  @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion Get single heart rate data 获取单次心率数据
 *
 */
-(NSMutableData*)GetSingleHRDataWithMode:(int)mode  withStartDate:(NSDate*)startDate;



/*!
 *  @method GetHRVDataWithMode::
 *  @param mode  0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: means to delete all HRV data  0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有HRV数据
    @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this   parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion Get HRV monitoring data   获取HRV历史数据
 *
 */
-(NSMutableData*)GetHRVDataWithMode:(int)mode  withStartDate:(NSDate*)startDate;

/*!
 *  @method GetActivityModeDataWithMode::
 *  @param mode  0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: means to delete all activity mode data  0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有运动类型历史数据
    @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this   parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion Get sports type historical data  获取运动类型历史数据
 *
 */
-(NSMutableData*)GetActivityModeDataWithMode:(int)mode  withStartDate:(NSDate*)startDate;


/*!
 *  @method GetAutomaticSpo2DataWithMode::
 *  @param mode  0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: means to delete all  automatic Spo2 data   0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有自动血氧历史数据
    @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this   parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion Get automatic Spo2 historical data  获取自动Spo2历史数据
 *
 */
-(NSMutableData*)GetAutomaticSpo2DataWithMode:(int)mode  withStartDate:(NSDate*)startDate;



/*!
 *  @method GetManualSpo2DataWithMode:
 *  @param mode  0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: means to delete all  manual Spo2 data   0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有手动血氧历史数据
    @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this   parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion Get manual Spo2 historical data  获取手动Spo2历史数据
 *
 */
-(NSMutableData*)GetManualSpo2DataWithMode:(int)mode  withStartDate:(NSDate*)startDate;


/*!
 *  @method GetTemperatureDataWithMode::
 *  @param mode    0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: means to delete all  temperature data   0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有体温历史数据
    @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this   parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion Get temperature history data  获取体温的历史数据
 *
 */
-(NSMutableData*)GetTemperatureDataWithMode:(int)mode  withStartDate:(NSDate*)startDate;



/*!
 *  @method GetAxillaryTemperatureDataWithMode::
 *  @param mode    0: It means to start reading from the latest position (up to 50 sets of data) 2: It means to read next (when the total number of data is greater than 50)     0x99: means to delete all  axillary temperature data   0:表示是从最新的位置开始读取(最多50组数据)  2:表示接着读取(当数据总数大于50的时候) 0x99:表示删除所有腋下体温历史数据
    @param  startDate  Read data from this date (note: this date must be exactly the same as the date of a piece of data stored in the watch, otherwise this   parameter will be invalid)    从这个日期开始读取数据(注意：这个日期一定是要与手环存储的某条数据的日期完全相同，否则这个参数将无效)
 *  @discussion  Get axillary temperature history data  获取腋下测量温度的历史数据
 *
 */
-(NSMutableData*)GetAxillaryTemperatureDataWithMode:(int)mode  withStartDate:(NSDate*)startDate;



/*!
 *  @method ClearAllHistoryData
 *  @discussion  Clear all historical data  清除所有历史数据
 *
 */
-(NSMutableData*)ClearAllHistoryData;



/*!
 *  @method EnterActivityMode:::
 *  @param activityMode   sport mode  运动模式
 *  @param WorkMode  Working mode 1: Enter 4: Exit  工作模式  1:进入  4:退出
 *  @param breathParameter When workMode is 6, you need to set the parameters of breathing exercise  当workMode是6的时候需要设置呼吸锻炼的参数
 *  @discussion Enter or exit multisport mode  进入或退出多运动模式
 *
 */
-(NSMutableData*)EnterActivityMode:(ACTIVITYMODE_J2208A)activityMode WorkMode:(int)WorkMode BreathParameter:(MyBreathParameter_J2208A)breathParameter ;

#warning AppSendToDevice 需要配合EnterActivityMode 一起使用
/*!
 *  @method AppSendToDevice:
 *  @param distance   距离
 *  @param pace_Minutes   Pace: minutes   配速:分钟
 *  @param pace_Seconds   Pace: Seconds  配速:秒
 *  @param GPS_SignalStrength   GPS signal strength  手机GPS信号强度
 *  @discussion When the watch enters the multi-sport mode through the APP, the APP must send a data to the watch every 1 second, otherwise the watch will exit the multi-sport mode, and these values ​​can be 0   当手表是通过APP进入多运动模式后，APP必须每隔1秒发送一个数据给手表，否则手表会退出多运动模式，这些值可以为0
 *
 */
-(NSMutableData*)AppSendToDevice:(float)distance pace_Minutes:(int)pace_Minutes pace_Seconds:(int)pace_Seconds GPS_SignalStrength:(int)GPS_SignalStrength;




/*!
 *  @method DataParsingWithData:
 *  @param bleData Data returned by the watch  手环返回的数据
 *  @discussion  data analysis 数据解析
 *
 */
-(DeviceData_J2208A*)DataParsingWithData:(NSData*_Nullable)bleData;
@end
