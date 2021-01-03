const AlexaInput = '0_userdata.0.AlexaToNodeRed.Input';
createState(AlexaInput, '',{name: 'Input Json from Alexa -> NodeRed', type: 'string', role: 'json'});

let actionObj = {
    deviceDP: '',
    deviceType: '',
    state: false,
    brightness: 0,
    get percentage(){
        return MapRange(this.brightness, 0, 254, 0, 100).toFixed();
    },
    colorTempMired:0,
    get colorTemp(){
        return Number(1000000 / this.colorTempMired).toFixed()
    },
    colorMode:'',
    colorRGB:{r:0, g:0, b:0},
    get colorHex(){
        return RGBToHex(this.colorRGB.r, this.colorRGB.g, this.colorRGB.b);
    },
    triggerKeys: []
}

on(AlexaInput,(obj)=>{
    const x = parsAlexaData(obj);
    //log(`Debug Log: ${JSON.stringify(x)}`);
    
    if (x.triggerKeys.includes('bri')){
        setBrightness(x);
    }  
    else if (x.triggerKeys.includes('hue')){
        setColor(x);
    }  
    else if (x.triggerKeys.includes('ct')){
        setColorTemp(x);
    }
    else if (x.triggerKeys.includes('on')){
        setOnOff(x);
    }  
});


/**
* @param {actionObj} obj
*/
function setBrightness(obj){
    if (obj.deviceType == 'zigbee') {
        setMyState(`${obj.deviceDP}.brightness`, Number(obj.percentage));
    } 
    else if (obj.deviceType == 'wled') {
        setMyState(`${obj.deviceDP}.bri`, obj.brightness);
    }
}

/**
* @param {actionObj} obj
*/
function setOnOff(obj){
    if (obj.deviceType == 'zigbee') {
        setMyState(`${obj.deviceDP}.state`, obj.state);
    } 
    else if (obj.deviceType == 'wled') {
        setMyState(`${obj.deviceDP}.on`, obj.state);
    }
}

/**
* @param {actionObj} obj
*/
function setColor(obj){
    if (obj.deviceType == 'zigbee') {
        setMyState(`${obj.deviceDP}.color`, obj.colorHex);
    } 
    else if (obj.deviceType == 'wled') {
        setMyState(`${obj.deviceDP}.seg.0.col.0_HEX`, obj.colorHex);
    }
}

/**
* @param {actionObj} obj
*/
function setColorTemp(obj){
    if (obj.deviceType == 'zigbee') {
        setMyState(`${obj.deviceDP}.colortemp`, Number(obj.colorTemp));
    } 
    else if (obj.deviceType == 'wled') {        
    }
}

/**
* @param {iobJS.ChangedStateObject} obj
*/
function parsAlexaData(obj){
    const x = JSON.parse(obj.state.val);
    const rgb = CieToRgb(x.xy[0], x.xy[1], undefined);  
    
    actionObj.deviceDP = x.topic;
    actionObj.deviceType = x.topic.split('.')[0];
    actionObj.state = x.on;
    actionObj.brightness = Number(x.bri);
    actionObj.colorTempMired = Number(x.ct);
    actionObj.colorMode = x.colormode;    
    actionObj.colorRGB = { r: rgb[0], g: rgb[1] , b: rgb[2] };
    actionObj.triggerKeys = Object.keys(x.meta.input);
    return actionObj;   
}


/// Tools

function setMyState(device, state){
    if (!existsState(device)){
        log(`State: ${state} for Device: ${device} rejected, state not exist!`, 'warn')
        return;
    }
    setState(device, state);
}

function CieToRgb(x, y, brightness) {
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

function MapRange(value, low1, high1, low2, high2) {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

function RGBToHex(r,g,b) {
  r = r.toString(16);
  g = g.toString(16);
  b = b.toString(16);

  if (r.length == 1)
    r = "0" + r;
  if (g.length == 1)
    g = "0" + g;
  if (b.length == 1)
    b = "0" + b;

  return "#" + r + g + b;
}
