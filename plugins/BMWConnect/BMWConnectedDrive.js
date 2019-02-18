'use strict'

//
//  BMWConnectedDrive.js
//  BMWConnectedDrive
//
//  Created by Thomas Kluge on 15.02.2019.
//  Copyright � 2019 kSquare.de. All rights reserved.
//
const URL = require('url').URL
let http = require('https')
let querystring = require('querystring')

var Vehicle = function () {}

var BMWConnectedDrive = function (username, password, logger) {
  this.username = username
  this.password = password
  this.logger = logger
  this.vehicles = []
}

BMWConnectedDrive.prototype.login = function (callback) {
  let url = 'https://customer.bmwgroup.com/gcdm/oauth/authenticate'

  var post_data = querystring.stringify({
    'state': 'eyJtYXJrZXQiOiJkZSIsImxhbmd1YWdlIjoiZGUiLCJkZXN0aW5hdGlvbiI6ImxhbmRpbmdQYWdlIn0',
    'username': this.username,
    'client_id': 'dbf0a542-ebd1-4ff0-a9a7-55172fbfce35',
    'password': this.password,
    'redirect_uri': 'https://www.bmw-connecteddrive.com/app/default/static/external-dispatch.html',
    'response_type': 'token',
    'scope': 'authenticate_user fupo',
    'locale': 'DE-de'
  })

  var that = this

  if (callback) {
    this.logger.debug('Connected Drive login')
    this.post_request(url, post_data, function (body, header) {
      if (header.location) {
        let match = header.location.match(/&access_token=([a-zA-z0-9]{0,})/)
        let token = match[1]
        that.token = token
        that.logger.debug('login done access_token saved')
        callback(token)
      }
    })
  } else {
    this.logger.error('missing callback')
  }
}

BMWConnectedDrive.prototype.getVehicles = function (callback) {
  this.vehicles = []
  let that = this

  this.logger.debug('Connected Drive Fetch all vehicles')
  let path = 'https://www.bmw-connecteddrive.de/api/me/vehicles/v2?all=true&brand=BM'
  if (callback) {
    this.get_request(path, function (result) {
      if (result !== undefined) {
        let objResult = JSON.parse(result)
        objResult.map(function (objVehicle) {
          // Only save bmw i vehicles ... we do not want the clunky old combustion stuff ;)
          if (objVehicle['brand'] === 'BMWi') {
            let vehicle = new Vehicle()
            vehicle.type = objVehicle['basicType']
            vehicle.vin = objVehicle['vin']
            vehicle.licensePlate = objVehicle['licensePlate']
            that.vehicles.push(vehicle)
          } else {
            that.logger.debug('%s is not an BEV', objVehicle.brand)
          }
        })
      }
      that.logger.debug('%s vehicles found', that.vehicles.length)
      callback(that.vehicles)
    })
  } else {
    this.logger.error('missing callback')
  }
}

/*
attributes:
   { updateTime_converted: '00.00.0000 00:00:00',
     condition_based_services: '',
     door_lock_state: 'SECURED',
     vehicle_tracking: '0|1',
     Segment_LastTrip_time_segment_end_formatted_time: '00:00',
     lastChargingEndReason: 'CHARGING_GOAL_REACHED',
     door_passenger_front: 'CLOSED',
     charging_inductive_positioning: 'not_positioned',
     check_control_messages: '',
     chargingHVStatus: 'INVALID',
     beMaxRangeElectricMile: '0.0',
     lights_parking: 'OFF',
     beRemainingRangeFuelKm: '0.0',
     connectorStatus: 'DISCONNECTED',
     kombi_current_remaining_range_fuel: '0.0',
     window_passenger_front: 'CLOSED',
     beRemainingRangeElectricMile: '0.0',
     mileage: '0',
     door_driver_front: 'CLOSED',
     updateTime: '00.00.0000 00:00:00 UTC',
     window_passenger_rear: 'CLOSED',
     Segment_LastTrip_time_segment_end: '00.00.0000 00:00:00 UTC',
     remaining_fuel: '0',
     updateTime_converted_time: '00:00',
     window_driver_front: 'CLOSED',
     chargeNowAllowed: 'NOT_ALLOWED',
     unitOfCombustionConsumption: 'l/100km',
     beMaxRangeElectric: '0.0',
     soc_hv_percent: '0.0',
     single_immediate_charging: 'isUnused',
     beRemainingRangeElectric: '000.0',
     heading: '000',
     'DCS_CCH_Ongoing ': null,
     charging_connection_type: 'CONDUCTIVE',
     Segment_LastTrip_time_segment_end_formatted: '00.00.0000 00:00:00',
     updateTime_converted_timestamp: '0',
     gps_lat: '00.00000',
     window_driver_rear: 'CLOSED',
     lastChargingEndResult: 'SUCCESS',
     trunk_state: 'CLOSED',
     hood_state: 'CLOSED',
     chargingLevelHv: '00.0',
     lastUpdateReason: 'DOORSTATECHANGED',
     beRemainingRangeFuel: '0.0',
     lsc_trigger: 'DOORSTATECHANGED',
     unitOfEnergy: 'kWh',
     Segment_LastTrip_time_segment_end_formatted_date: '00.00.000',
     prognosisWhileChargingStatus: 'NOT_NEEDED',
     beMaxRangeElectricKm: '000.0',
     unitOfElectricConsumption: 'kWh/100km',
     Segment_LastTrip_ratio_electric_driven_distance: '000',
     head_unit_pu_software: '00/00',
     DCS_CCH_Activation: null,
     head_unit: 'NBT',
     chargingSystemStatus: 'NOCHARGING',
     door_driver_rear: 'CLOSED',
     charging_status: 'NOCHARGING',
     beRemainingRangeFuelMile: '0.0',
     beRemainingRangeElectricKm: '00.0',
     gps_lng: '00.000000',
     door_passenger_rear: 'CLOSED',
     updateTime_converted_date: '00.00.0000',
     unitOfLength: 'km',
     chargingLogicCurrentlyActive: 'NOT_CHARGING',
     battery_size_max: '00000' } }
     */

BMWConnectedDrive.prototype.getVehicleData = function (vehicle, callback) {
  if (callback) {
    let vin = vehicle.vin
    let path = 'https://www.bmw-connecteddrive.de/api/vehicle/dynamic/v1/' + vin + '?offset=-60'
    if (vin) {
      this.get_request(path, function (result) {
        if (result !== undefined) {
          let objResult = JSON.parse(result)
          vehicle.attributes = objResult['attributesMap']
        }
        callback(vehicle)
      })
    } else {
      callback(undefined)
    }
  } else {
    this.logger.error('missing callback')
  }
}

BMWConnectedDrive.prototype.get_request = function (callurl, callback) {
  var that = this
  if (this.token !== undefined) {
  // An object of options to indicate where to post to
    const myURL = new URL(callurl)
    var options = {
      host: myURL.hostname,
      port: '443',
      path: myURL.pathname,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + this.token,
        'Accept': 'application/json, text/plain, */*',
        'Connection': 'Close',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15'
      }
    }

    var post_req = http.request(options, function (res) {
      var data = ''

      res.setEncoding('utf8')

      res.on('data', function (chunk) {
        data += chunk.toString()
      })

      res.on('end', function () {
        if (callback) { callback(data) }
      })
    })

    post_req.on('error', function (e) {
      that.logger.warn('Error %s while executing', e)
      if (callback) { callback(undefined) }
    })

    post_req.on('timeout', function (e) {
      that.logger.warn('timeout from while executing')
      if (callback) { callback(undefined) }
    })

    post_req.setTimeout(5000)
    post_req.end()
  } else {
    this.logger.error('Missing token .. please do a login first')
  }
}

BMWConnectedDrive.prototype.post_request = function (callurl, post_data, callback) {
  var that = this
  const myURL = new URL(callurl)

  // An object of options to indicate where to post to
  var post_options = {
    host: myURL.hostname,
    port: '443',
    path: myURL.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      'Content-Length': Buffer.byteLength(post_data),
      'Connection': 'Close',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15'
    }
  }

  var post_req = http.request(post_options, function (res) {
    var data = ''

    res.setEncoding('utf8')

    res.on('data', function (chunk) {
      data += chunk.toString()
    })

    res.on('end', function () {
      if (callback) { callback(data, res.headers) }
    })
  })

  post_req.on('error', function (e) {
    that.logger.warn('Error %s while executing', e)
    if (callback) { callback(undefined) }
  })

  post_req.on('timeout', function (e) {
    that.logger.warn('timeout from while executing')
    if (callback) { callback(undefined) }
  })

  post_req.setTimeout(4000)
  post_req.write(post_data)
  post_req.end()
}

module.exports = {
  BMWConnectedDrive: BMWConnectedDrive,
  Vehicle: Vehicle
}
