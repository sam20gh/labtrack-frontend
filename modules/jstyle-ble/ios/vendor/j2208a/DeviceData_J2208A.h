//
//  DeviceData.h
//  BleSDK
//
//  Created by yang sai on 2022/4/27.
//

#import <Foundation/Foundation.h>
#import "BleSDK_Header_J2208A.h"
NS_ASSUME_NONNULL_BEGIN

@interface DeviceData_J2208A : NSObject
@property  DATATYPE_J2208A dataType;
@property(nullable,nonatomic) NSDictionary * dicData;
@property BOOL dataEnd;
@end

NS_ASSUME_NONNULL_END
