const alexaInputDP = '0_userdata.0.AlexaToNodeRed.Input';
const alexaOutputDP = '0_userdata.0.AlexaToNodeRed.Output';
const alexaDatabaseDP = '0_userdata.0.AlexaToNodeRed.Database';

const deviceTypeDatapointMap = {
    customBlind: { bri: { dp: 'position', min: 0, max: 100 }, hue: '', ct: '', on: '' },
    zigbee2mqtt: { bri: { dp: 'brightness', min: 0, max: 100 }, hue: 'color', ct: 'colortemp', on: 'state' },
    wled: { bri: { dp: 'bri', min: 0, max: 254 }, hue: 'seg.0.col.0_HEX', ct: '', on: 'on' }
}

const inputObj = {
    deviceDP: '',
    deviceType: '',
    deviceAlexaID: '',
    state: false,
    brightness: 0,
    get percentage() {
        return mapRange(this.brightness, 0, 254, 0, 100).toFixed();
    },
    colorTempMired: 0,
    get colorTemp() {
        return miredKelvinConversion(this.colorTempMired);
    },
    colorMode: '',
    hue: 0,
    sat: 0,
    get colorHex() {
        return hsvToRgb(this.hue, this.sat, 1.0);
    },
    triggerKeys: []
}

createState(alexaInputDP, '', { name: 'Input Json from Alexa -> NodeRed', type: 'string', role: 'json' });
createState(alexaOutputDP, '', { name: 'Output Json to NodeRed -> Alexa', type: 'string', role: 'json' });
createState(alexaDatabaseDP, '{}', { name: 'Database for ioBroker -> NodeRed -> Alexa', type: 'string', role: 'json' });

const database = JSON.parse(getState(alexaDatabaseDP).val);

for (const key in database) {
    createAlexaDPSubs(key)
}

on(alexaInputDP, (obj) => {
    const x = parsAlexaData(obj);
    // Nur in Database schreiben wenn Daten neu oder verändert wurden.
    if (!database[x.deviceDP] || database[x.deviceDP] != x.deviceAlexaID) {
        database[x.deviceDP] = x.deviceAlexaID;
        createAlexaDPSubs(x.deviceDP);
        setState(alexaDatabaseDP, JSON.stringify(database), true);
    }

    if (x.triggerKeys.includes('bri')) {
        setMyState(`${x.deviceDP}.${deviceTypeDatapointMap[x.deviceType].bri.dp}`, Number(x.percentage));
    }
    else if (x.triggerKeys.includes('hue')) {
        setMyState(`${x.deviceDP}.${deviceTypeDatapointMap[x.deviceType].hue}`, x.colorHex);
    }
    else if (x.triggerKeys.includes('ct')) {
        setMyState(`${x.deviceDP}.${deviceTypeDatapointMap[x.deviceType].ct}`, Number(x.colorTemp));
    }
    else if (x.triggerKeys.includes('on')) {
        setMyState(`${x.deviceDP}.${deviceTypeDatapointMap[x.deviceType].on}`, x.state);
    }
});

/// Tools

/**
* @param {iobJS.ChangedStateObject} obj
*/
function parsAlexaData(obj) {
    const x = JSON.parse(obj.state.val);

    inputObj.deviceType = getDeviceType(x.topic);
    inputObj.deviceDP = inputObj.deviceType.startsWith('custom') ? x.topic.replace(`${inputObj.deviceType}.`, '') : x.topic;
    inputObj.deviceAlexaID = x.deviceid;
    inputObj.state = x.on;
    inputObj.brightness = Number(x.bri);
    inputObj.colorTempMired = Number(x.ct);
    inputObj.colorMode = x.colormode;
    inputObj.hue = x.hue / 182,
    inputObj.sat = x.sat / 254,
    inputObj.triggerKeys = Object.keys(x.meta.input);
    log(JSON.stringify(inputObj));
    return inputObj;
}

function createAlexaDPSubs(device) {
    const deviceType = getDeviceType(device);
    const dataPoints = deviceTypeDatapointMap[deviceType];

    for (const dp in dataPoints) {
        if (!isEmpty(dataPoints[dp])) {
            let dataPoint = dataPoints[dp];
            if (typeof dataPoint == 'object') {
                dataPoint = dataPoint.dp;
            }

            on(`${device}.${dataPoint}`, (obj) => {
                const alexaDataPoint = getKeyByValue(dataPoints, getDataPoint(obj.id));
                const alexaObj = {};
                alexaObj.nodeid = database[getDevice(obj.id)];

                if (alexaDataPoint == 'hue') {
                    const color = hexToRgb(obj.state.val);
                    alexaObj.xy = rgbToCie(color.r, color.g, color.b);
                }
                else if (alexaDataPoint == 'bri') {
                    alexaObj.bri = mapRange(obj.state.val, dataPoints[dp].min, dataPoints[dp].max, 0, 254,).toFixed();
                }
                else if (alexaDataPoint == 'ct') {
                    alexaObj.ct = toMired(obj.state.val);
                }
                else {
                    alexaObj[alexaDataPoint] = obj.state.val;
                }

                setState(alexaOutputDP, JSON.stringify(alexaObj), true);
            });
        }
    }
}

function setMyState(device, state) {
    // if (!existsState(device)) {
    //     log(`State: ${state} for Device: ${device} rejected, state not exist!`, 'warn');
    //     return;
    // }
    setState(device, state);
    log(`Set ${device} of ${state}`);
}

function padding(num) {
    num = num.toString(16);
    if (num.length < 2) num = `0${num}`;
    return num;
}

function rgbToCie(red, green, blue) {
    // Apply a gamma correction to the RGB values, which makes the color more vivid and more the like the color displayed on the screen of your device
    red = (red > 0.04045) ? Math.pow((red + 0.055) / (1.0 + 0.055), 2.4) : (red / 12.92);
    green = (green > 0.04045) ? Math.pow((green + 0.055) / (1.0 + 0.055), 2.4) : (green / 12.92);
    blue = (blue > 0.04045) ? Math.pow((blue + 0.055) / (1.0 + 0.055), 2.4) : (blue / 12.92);

    // RGB values to XYZ using the Wide RGB D65 conversion formula
    const X = red * 0.664511 + green * 0.154324 + blue * 0.162028;
    const Y = red * 0.283881 + green * 0.668433 + blue * 0.047685;
    const Z = red * 0.000088 + green * 0.072310 + blue * 0.986039;

    // Calculate the xy values from the XYZ values
    let x = (X / (X + Y + Z)).toFixed(4);
    let y = (Y / (X + Y + Z)).toFixed(4);

    if (isNaN(x)) {
        x = 0;
    }

    if (isNaN(y)) {
        y = 0;
    }

    return [x, y];
}

function hsvToRgb(h, s, v) {
    let r;
    let g;
    let b;
    h = h / 360;
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - f * s);
    const t = v * (1 - (1 - f) * s);

    switch(i % 6){
        case 0:
            r = v;
            g = t;
            b = p;
            break;

        case 1:
            r = q;
            g = v;
            b = p;
            break;

        case 2:
            r = p;
            g = v;
            b = t;
            break;

        case 3:
            r = p;
            g = q;
            b = v;
            break;

        case 4:
            r = t;
            g = p;
            b = v;
            break;

        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }
    return `#${padding(Math.round(r * 255))}${padding(Math.round(g * 255))}${padding(Math.round(b * 255))}`;
}

function mapRange(value, low1, high1, low2, high2) {
    return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
function hexToRgb(hex) {
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
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

function isEmpty(str) {
    return (!str || str.length === 0 || !String(str).trim());
}

function getDeviceType(str) {
    return str.split('.')[0];
}

function getDevice(str) {
    return str.substring(0, str.lastIndexOf('.'));
}

function getDataPoint(str) {
    return str.substring(str.lastIndexOf('.') + 1);
}

function toMired(t) {
    let miredValue = t;
    if (t > 1000) {
        miredValue = miredKelvinConversion(t);
    }
    return miredValue;
}

function miredKelvinConversion(t) {
    return (1000000 / t).toFixed();
}
