//
//  BleSDK_Header.h
//  BleSDK
//
//  Created by yang sai on 2022/4/27.
//

#ifndef BleSDK_Header_J2208A_h
#define BleSDK_Header_J2208A_h


typedef NS_ENUM(NSInteger, DATATYPE_J2208A) {
    GetDeviceTime_J2208A = 0,
    SetDeviceTime_J2208A = 1,
    GetPersonalInfo_J2208A = 2,
    SetPersonalInfo_J2208A = 3,
    GetDeviceInfo_J2208A = 4,
    SetDeviceInfo_J2208A = 5,
    SetDeviceID_J2208A = 6,
    GetDeviceGoal_J2208A = 7,
    SetDeviceGoal_J2208A = 8,
    GetDeviceBattery_J2208A = 9,
    GetDeviceMacAddress_J2208A = 10,
    GetDeviceVersion_J2208A = 11,
    FactoryReset_J2208A = 12,
    MCUReset_J2208A = 13,
    MotorVibration_J2208A = 14,
    GetDeviceName_J2208A = 15,
    SetDeviceName_J2208A = 16,
    GetAutomaticMonitoring_J2208A = 17,
    SetAutomaticMonitoring_J2208A = 18,
    GetAlarmClock_J2208A = 19,
    SetAlarmClock_J2208A = 20,
    DeleteAllAlarmClock_J2208A = 21,
    GetSedentaryReminder_J2208A = 22,
    SetSedentaryReminder_J2208A = 23,
    RealTimeStep_J2208A = 24,
    TotalActivityData_J2208A = 25,
    DetailActivityData_J2208A = 26,
    DetailSleepData_J2208A = 27,
    DynamicHR_J2208A = 28,
    StaticHR_J2208A = 29,
    ActivityModeData_J2208A = 30,
    EnterActivityMode_J2208A = 31,
    QuitActivityMode_J2208A = 32,
    DeviceSendDataToAPP_J2208A = 33,
    EnterTakePhotoMode_J2208A = 34,
    StartTakePhoto_J2208A = 35,
    StopTakePhoto_J2208A = 36,
    BackHomeView_J2208A = 37,
    HRVData_J2208A = 38,
    GPSData_J2208A = 39,
    SetSocialDistanceReminder_J2208A = 40,
    GetSocialDistanceReminder_J2208A = 41,
    AutomaticSpo2Data_J2208A = 42,
    ManualSpo2Data_J2208A = 43,
    FindMobilePhone_J2208A = 44,
    TemperatureData_J2208A = 45,
    AxillaryTemperatureData_J2208A = 46,
    SOS_J2208A  =  47,
    ECG_HistoryData_J2208A = 48,
 
    StartECG_J2208A = 49,
    StopECG_J2208A  = 50,
    ECG_RawData_J2208A = 51,
    ECG_Success_Result_J2208A  = 52,
    ECG_Status_J2208A  = 53,
    ECG_Failed_J2208A =  54,
    DeviceMeasurement_HR_J2208A =  55,
    DeviceMeasurement_HRV_J2208A =  56,
    DeviceMeasurement_Spo2_J2208A =  57,
    DeviceMeasurement_Temperature_J2208A = 58,
    lockScreen_J2208A = 59,
    clickYesWhenUnLockScreen_J2208A = 60,
    clickNoWhenUnLockScreen_J2208A = 61,
    setWeather_J2208A  =  62,
    openRRInterval_J2208A  =  63,
    closeRRInterval_J2208A  =  64,
    realtimeRRIntervalData_J2208A  =  65,
    realtimePPIData_J2208A  =  66,
    realtimePPGData_J2208A  =  67,
    ppgStartSucessed_J2208A = 68,
    ppgStartFailed_J2208A = 69,
    ppgResult_J2208A = 70,
    ppgStop_J2208A = 71,
    ppgQuit_J2208A = 72,
    ppgMeasurementProgress_J2208A = 73,
    clearAllHistoryData_J2208A = 74,
    setMenstruationInfo_J2208A = 75,
    setPregnancyInfo_J2208A = 76,
    

    DataError_J2208A =  255
};



typedef struct DeviceTime_J2208A {
    int year;
    int month;
    int day;
    int hour;
    int minute;
    int second;
} MyDeviceTime_J2208A;

typedef struct PersonalInfo_J2208A {
    int gender;
    int age;
    int height;
    int weight;
    int stride;
} MyPersonalInfo_J2208A;

typedef struct NotificationType_J2208A {
    int call;
    int SMS;
    int wechat;
    int facebook;
    int instagram;
    int skype;
    int telegram;
    int twitter;
    int vkclient;
    int whatsapp;
    int qq;
    int In;
} MyNotificationType_J2208A;

typedef struct DeviceInfo_J2208A {
    int ANCS;
    MyNotificationType_J2208A notificationType;
    int baseHeartRate;
} MyDeviceInfo_J2208A;




typedef struct Weeks_J2208A {
    BOOL sunday;
    BOOL monday;
    BOOL Tuesday;
    BOOL Wednesday;
    BOOL Thursday;
    BOOL Friday;
    BOOL Saturday;
} MyWeeks_J2208A;


/**
 AutomaticMonitoring
 mode:工作模式，0：关闭  1:时间段工作方式，2： 时间段内间隔工作方式
 startTime_Hour: 开始时间的小时
 startTime_Minutes: 开始时间的分钟
 endTime_Hour:
*/

typedef struct AutomaticMonitoring_J2208A {
    int mode;
    int startTime_Hour;
    int startTime_Minutes;
    int endTime_Hour;
    int endTime_Minutes;
    MyWeeks_J2208A weeks;
    int intervalTime;
    int dataType;// 1 means heartRate  2 means spo2  3 means temperature  4 means HRV
} MyAutomaticMonitoring_J2208A;

typedef struct SedentaryReminder_J2208A {
    int startTime_Hour;
    int startTime_Minutes;
    int endTime_Hour;
    int endTime_Minutes;
    MyWeeks_J2208A weeks;
    int intervalTime;
    int leastSteps;
    int mode;
} MySedentaryReminder_J2208A;

typedef struct AlarmClock_J2208A {
    int openOrClose;
    int clockType;
    int endTime_Hour;
    int endTime_Minutes;
    int weeks;
    int intervalTime;
    int leastSteps;
    int mode;
} MyAlarmClock_J2208A;

typedef struct BPCalibrationParameter_J2208A {
    int gender;
    int age;
    int height;
    int weight;
    int BP_high;
    int BP_low;
    int heartRate;
} MyBPCalibrationParameter_J2208A;


typedef struct WeatherParameter_J2208A {
    int weatherType;
    int currentTemperature;
    int highestTemperature;
    int lowestTemperature;
    NSString * strCity;
} MyWeatherParameter_J2208A;

typedef struct BreathParameter_J2208A {
    int breathMode;
    int DurationOfBreathingExercise;
} MyBreathParameter_J2208A;

typedef struct SocialDistanceReminder_J2208A {
    char scanInterval;
    char scanTime;
    char signalStrength;
} MySocialDistanceReminder_J2208A;


typedef NS_ENUM(NSInteger, ACTIVITYMODE_J2208A) {
    Run_J2208A = 0,
    Cycling_J2208A    = 1,
    Badminton_J2208A = 2,
    Football_J2208A    = 3,
    Tennis_J2208A = 4,
    Yoga_J2208A    = 5,
    Breath_J2208A = 6,
    Dance_J2208A    = 7,
    Basketball_J2208A = 8,
    Walk_J2208A    = 9,
    Workout_J2208A    = 10,
    Cricket_J2208A    = 11,
    Hiking_J2208A    = 12,
    Aerobics_J2208A    = 13,
    PingPong_J2208A    = 14,
    RopeJump_J2208A    = 15,
    SitUps_J2208A    = 16,
    Volleyball_J2208A    = 17
};

#endif /* BleSDK_Header_J2208A_h */
