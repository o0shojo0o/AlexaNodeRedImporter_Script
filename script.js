const alexaInputDP = '0_userdata.0.AlexaToNodeRed.Input';
const alexaOutputDP = '0_userdata.0.AlexaToNodeRed.Output';
const alexaDatabaseDP = '0_userdata.0.AlexaToNodeRed.Database';

const deviceTypeDPs = {
    zigbee: { bri:{ dp:'brightness', min:0, max:100 }, hue:'color', ct:'colortemp', on:'state' },
    wled: { bri:{ dp:'bri', min:0, max:254 }, hue:'seg.0.col.0_HEX', ct:'', on:'on' }
}

const actionObj = {
    deviceDP: '',
    deviceType: '',
    deviceAlexaID: '', 
    state: false,
    brightness: 0,
    get percentage() {
        return mapRange(this.brightness, 0, 254, 0, 100).toFixed();
    },
    colorTempMired:0,
    get colorTemp() {
        return miredKelvinConversion(this.colorTempMired);
    },
    colorMode:'',
    colorRGB: { r:0, g:0, b:0 },
    get colorHex() {
        return rgbToHex(this.colorRGB.r, this.colorRGB.g, this.colorRGB.b);
    },
    triggerKeys: []
}

createState(alexaInputDP, '',{name: 'Input Json from Alexa -> NodeRed', type: 'string', role: 'json'});
createState(alexaOutputDP, '',{name: 'Output Json to NodeRed -> Alexa', type: 'string', role: 'json'});
createState(alexaDatabaseDP, '{}',{name: 'Database for ioBroker -> NodeRed -> Alexa', type: 'string', role: 'json'});

const database = JSON.parse(getState(alexaDatabaseDP).val);

for (const key in database){   
    createAlexaDPSubs(key)  
}

on(alexaInputDP,(obj)=> {
    const x = parsAlexaData(obj);   
    // Nur in Database schreiben wenn Daten neu oder verändert wurden.
    if (!database[x.deviceDP] || database[x.deviceDP] != x.deviceAlexaID){
        database[x.deviceDP] = x.deviceAlexaID;
        createAlexaDPSubs(x.deviceDP);
        setState(alexaDatabaseDP, JSON.stringify(database), true);
    }
    
    if (x.triggerKeys.includes('bri')) {
        setMyState(`${x.deviceDP}.${deviceTypeDPs[x.deviceType].bri.dp}`, Number(x.percentage));
    }  
    else if (x.triggerKeys.includes('hue')) {
        setMyState(`${x.deviceDP}.${deviceTypeDPs[x.deviceType].hue}`, x.colorHex);   
    }  
    else if (x.triggerKeys.includes('ct')) {
        setMyState(`${x.deviceDP}.${deviceTypeDPs[x.deviceType].ct}`, Number(x.colorTemp)); 
    }
    else if (x.triggerKeys.includes('on')) {
        setMyState(`${x.deviceDP}.${deviceTypeDPs[x.deviceType].on}`, x.state);
    }  
});

/// Tools

/**
* @param {iobJS.ChangedStateObject} obj
*/
function parsAlexaData(obj) {
    const x = JSON.parse(obj.state.val);
    const rgb = cieToRgb(x.xy[0], x.xy[1], undefined);  
    
    actionObj.deviceDP = x.topic;
    actionObj.deviceType = getDeviceType(x.topic);
    actionObj.deviceAlexaID = x.deviceid;
    actionObj.state = x.on;
    actionObj.brightness = Number(x.bri);
    actionObj.colorTempMired = Number(x.ct);
    actionObj.colorMode = x.colormode;    
    actionObj.colorRGB = { r: rgb[0], g: rgb[1] , b: rgb[2] };
    actionObj.triggerKeys = Object.keys(x.meta.input);
    return actionObj;   
}

function createAlexaDPSubs(device){
    const deviceType = getDeviceType(device);
    const dataPoints = deviceTypeDPs[deviceType];      
    
    for (const dp in dataPoints) {
        if (!isEmpty(dataPoints[dp])) {
            let dataPoint = dataPoints[dp];
            if (typeof dataPoint == 'object'){
                dataPoint = dataPoint.dp;
            }

            on(`${device}.${dataPoint}`,(obj)=> {
                const alexaDataPoint = getKeyByValue(dataPoints, getDataPoint(obj.id));
                const alexaObj = {};
                alexaObj.nodeid = database[getDevice(obj.id)];
                
                if (alexaDataPoint == 'hue') {
                    const color = hexToRgb(obj.state.val);
                    alexaObj.xy = rgbToCie(color.r, color.g, color.b);
                }
                else if (alexaDataPoint == 'bri') {
                    alexaObj.bri = mapRange(obj.state.val, dataPoints[dp].min, dataPoints[dp].max,  0, 254,).toFixed();
                }
                else if (alexaDataPoint == 'ct') {
                    alexaObj.ct = toMired(obj.state.val);
                }
                else {
                    alexaObj[alexaDataPoint] = obj.state.val; 
                }
                 
                setState(alexaOutputDP,JSON.stringify(alexaObj), true);  
            });
        }
    }          
}

function setMyState(device, state) {
    if (!existsState(device)){
        log(`State: ${state} for Device: ${device} rejected, state not exist!`, 'warn')
        return;
    }
    setState(device, state);
}

function cieToRgb(x, y, brightness) {
    //Set to maximum brightness if no custom value was given (Not the slick ECMAScript 6 way for compatibility reasons)
    if (brightness === undefined) {
        brightness = 254;
    }

    const z = 1.0 - x - y;
    const Y = Number((brightness / 254).toFixed(2));
    const X = (Y / y) * x;
    const Z = (Y / y) * z;

    //Convert to RGB using Wide RGB D65 conversion
    let red 	=  X * 1.656492 - Y * 0.354851 - Z * 0.255038;
    let green = -X * 0.707196 + Y * 1.655397 + Z * 0.036152;
    let blue 	=  X * 0.051713 - Y * 0.121364 + Z * 1.011530;

    //If red, green or blue is larger than 1.0 set it back to the maximum of 1.0
    if (red > blue && red > green && red > 1.0) {

        green = green / red;
        blue = blue / red;
        red = 1.0;
    }
    else if (green > blue && green > red && green > 1.0) {

        red = red / green;
        blue = blue / green;
        green = 1.0;
    }
    else if (blue > red && blue > green && blue > 1.0) {

        red = red / blue;
        green = green / blue;
        blue = 1.0;
    }

    //Reverse gamma correction
    red 	= red   <= 0.0031308 ? 12.92 * red   : (1.0 + 0.055) * Math.pow(red,   (1.0 / 2.4)) - 0.055;
    green 	= green <= 0.0031308 ? 12.92 * green : (1.0 + 0.055) * Math.pow(green, (1.0 / 2.4)) - 0.055;
    blue 	= blue  <= 0.0031308 ? 12.92 * blue  : (1.0 + 0.055) * Math.pow(blue,  (1.0 / 2.4)) - 0.055;


    //Convert normalized decimal to decimal
    red 	= Math.round(red * 255);
    green 	= Math.round(green * 255);
    blue 	= Math.round(blue * 255);

    if (isNaN(red) || red < 0 ) {
        red = 0;
    }

    if (isNaN(green) || green < 0 ) {
        green = 0;
    }

    if (isNaN(blue) || blue < 0 ) {
        blue = 0;
    }

    return [red, green, blue];
}

function rgbToCie(red, green, blue) {
    // Apply a gamma correction to the RGB values, which makes the color more vivid and more the like the color displayed on the screen of your device
    red 	= (red > 0.04045) ? Math.pow((red + 0.055) / (1.0 + 0.055), 2.4) : (red / 12.92);
    green 	= (green > 0.04045) ? Math.pow((green + 0.055) / (1.0 + 0.055), 2.4) : (green / 12.92);
    blue 	= (blue > 0.04045) ? Math.pow((blue + 0.055) / (1.0 + 0.055), 2.4) : (blue / 12.92);

    // RGB values to XYZ using the Wide RGB D65 conversion formula
    const X 		= red * 0.664511 + green * 0.154324 + blue * 0.162028;
    const Y 		= red * 0.283881 + green * 0.668433 + blue * 0.047685;
    const Z 		= red * 0.000088 + green * 0.072310 + blue * 0.986039;

    // Calculate the xy values from the XYZ values
    let x 		= (X / (X + Y + Z)).toFixed(4);
    let y 		= (Y / (X + Y + Z)).toFixed(4);

    if (isNaN(x)) {
        x = 0;
    }

    if (isNaN(y)) {
        y = 0;
    }

    return [x, y];
}

function mapRange(value, low1, high1, low2, high2) {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

function rgbToHex(r,g,b) {
  r = r.toString(16);
  g = g.toString(16);
  b = b.toString(16);

  if (r.length == 1){
    r = "0" + r;
  }
  if (g.length == 1){
    g = "0" + g;
  }
  if (b.length == 1){
    b = "0" + b;
  }
  
  return "#" + r + g + b;
}

// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
function hexToRgb(hex) {    
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
      return r + r + g + g + b + b;
    });
  
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
}

function getKeyByValue(object, value) {
    let result = Object.keys(object).find(key => (object[key].dp && object[key].dp == value) || object[key] == value);   
    return result;
}

function isEmpty (str) {
    return (!str || str.length === 0 || !String(str).trim());
}

function getDeviceType(str) {
    return str.split('.')[0];
}

function getDevice(str){
    return str.substring(0, str.lastIndexOf('.'));
}

function getDataPoint(str){
    return str.substring(str.lastIndexOf('.') + 1);
}

function toMired(t) {   
    let miredValue = t;    
    if (t > 1000){
        miredValue = miredKelvinConversion(t);
    }    
    return miredValue;    
}

function miredKelvinConversion(t) {   
    return (1000000 / t).toFixed();
}
