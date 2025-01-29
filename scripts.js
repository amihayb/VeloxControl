let serialPort;
let writer;
let reader;

let intervalMove;

let motorOn = false;
let joystickTr = 0;
let joystickEl = 0;
let changeDir = false;


function openClosePort(event) {
    const button = document.getElementById('connectButton');
    if (button.textContent === 'Connect') {
        requestSerialPort()
        //if (serialPort) {
        button.textContent = 'Disconnect';
        button.style.background = "#008080";
        /*} else {
            button.textContent = 'Nope';
            button.style.background="#108080";
        }*/
    } else {
        closeSerialPort();
        button.textContent = 'Connect';
        button.style.background = "#5898d4";
    }
}

async function requestSerialPort() {
    try {
        serialPort = await navigator.serial.requestPort();
        await serialPort.open({ baudRate: 115200 });   // Velox
        writer = await serialPort.writable.getWriter();
        reader = await serialPort.readable.getReader();
        console.log('Serial port opened successfully!');
        return true;
    } catch (error) {
        console.error('Error connecting to serial port:', error);
        return false;
    }
}

async function sendMsg(message, envelope = true) {
    if (!serialPort) {
        console.error('Serial port not opened. Click "Open Serial Port" first.');
        return;
    }
    //const writer = serialPort.writable.getWriter();
    //let message = 'Yes!';
    //message = message + '\r';
    //const message1 = [0xE4, 0xA5, 0x00, 0xD5, 0x0C, 0x09, 0x06, 0x06, 0xE8, 0x03, 0x00, 0x00, 0xC0, 0x40, 0xDA]; // Set V0 to 6
    let data;
    if (envelope) {
        const prefix = [228, 165, 0, 213];
        const suffix = 218;
        data = new Uint8Array([...prefix, message.length+3, ...message, suffix]);
    } else {
        data = new Uint8Array(message);
        //console.log(message);
    }
    await writer.write(data);
    //await writer.write(new TextEncoder().encode(message));
    
    //writer.releaseLock();
    //console.log(`Sent: ${sent}`);
}

async function closeSerialPort() {
    if (serialPort) {
        await writer.releaseLock();
        await reader.releaseLock();
        await serialPort.close();
        console.log('Serial port closed.');
    }
}

async function readMsg(message) {
    // Send the message
  
    // Initialize the reader for the serial port
    // let reader = serialPort.readable.getReader();
  
    try {
      // Read data from the serial port
      const { value, done } = await reader.read();
      console.log(value);
      if (value) {
        // Convert Uint8Array to string and process the response
        //const decodedValue = new TextDecoder().decode(value);
        response = value;
        console.log(response);
        return response; // Return the processed response
      } else {
        console.warn("No data received or connection closed.");
        return null;
      }
    } catch (error) {
      console.error("Error reading from serial port:", error);
      return null;
    } finally {
      // Always release the reader lock
    //   await reader.releaseLock();
    }
  }


function setMotor(motorReq){
    if (motorReq !== motorOn) {
        motorOn = motorReq;

        const motorOnButton = document.getElementById('motorOnButton');
        if (motorOn) {
            motorOnButton.style.background = "#008080";
            motorOnButton.textContent = 'Motor Off';
        } else {
            motorOnButton.style.background = "#5898d4";
            motorOnButton.textContent = 'Motor On';
        }
      }
}

function motorState() {
    //const button = document.getElementById('motorOnButton');
    let message = [9,6,6,232,3]; // Set V0
    if (motorOn) {
        // Turn Motors Off
        message.push(...get4Bytes(11)); // Off
        sendMsg(message);
    } else { // Turn Motors On
        if (!serialPort) {
            alert('Please connect to driver first');
        } else {
            message.push(...get4Bytes(10)); // On
            sendMsg(message);
            //button.style.background = "#008080";
            //button.textContent = 'Motor Off';
        }
    }
    setMotor(!motorOn);
}

function goToAngle() {

    // if (motorOn) {
        const trAngInput = document.getElementById('angTr-input');
        const elAngInput = document.getElementById('angEl-input');
        const trAngValue = trAngInput.value;
        const elAngValue = elAngInput.value;
        
        let message = [...moveCmd(trAngValue,1), ...moveCmd(elAngValue,0)];
        console.log(message);
        sendMsg(message);
        setMotor(true);
    // } else {
    //     alert('Motors are off, \nPlease turn on motors first');
    //}
}

function startScenario(scenarioNumber) {

    let message = [];

    //if (motorOn) {
        joystickTr = 0;
        joystickEl = 0;

        switch (scenarioNumber) {

            case 1:  // Homing - Set V0 to 6
                // message = [0xE4, 0xA5, 0x00, 0xD5, 0x0C, 0x09, 0x06, 0x06, 0xE8, 0x03, 0x00, 0x00, 0xC0, 0x40, 0xDA]; // Set V0 to 6
                // message = [9,6,6,232,3,0,0,192,64];
                message = sendMsg(setV0(6));   // Homing
                setTimeout(() => {
                    sendMsg(setV0(12));
                    console.log('Set drift done');
                }, 22000);
                
                break;

            case 2:   // Stab
                message = setV0(15);   // Stab Mode
                //message = [9,6,6,232,3]; // Set V0
                //message.push(...get4Bytes(15));
                setMotor(true);
                sendMsg(message);
                break

            case 3:   // Pano
                message = setV0(14);   // Pano mode
                sendMsg(message);
                setMotor(true);
                message = setV0(10);   // Motor On
                sendMsg(message);
                break

            case 4:   // Pano Scan
                panoScan();
                message = [6,4,232,3];
                sendMsg(message);
                //message = [9,6,6,232,3]; // Set V0
                //message.push(...get4Bytes(14));
                // setMotor(true);
                break        
                
            case 5:   // Run Record
                message = setV0(15);   // Stab Mode
                setMotor(true);
                sendMsg(message);
                runRecord();
                break 
        }

        console.log(message);
        //sendMsg(message);
    // } else {
    //     alert('Please turn on motors first');
    // }
}


function panoScan(){
    sendMsg( setV0(14) );   // Pano mode
    sendMsg( setV0(10) );   // Motor On
    setMotor(true);


    if (intervalMove) {
        clearInterval(intervalMove);
        intervalMove = null;
        console.log("Stopped sending commands");
    } else {
        console.log("Start sending commands");
        intervalMove = setInterval(() => {
            //if (readV18()) {
                message = moveCmd(-7+18*changeDir,1);  // Move Tr
                // message = moveCmd(-7+14*changeDir,0);  // Move El 
                sendMsg(message);
                changeDir = !changeDir;
            //}
        }, 270);// 170
    }

    // sendMsg( moveCmd() )

    //sendMsg([6,4,232,3])
    //readFromSerial();
}


async function readFromSerial() {
    //const reader = serialPort.readable.getReader();
  
    try {
      while (true) {
        const { value, done } = await reader.read();
  
        if (done) {
          // Allow the serial port to be closed if there's no data
          console.log("Serial port closed");
          break;
        }
  
        if (value) {
          // Convert Uint8Array to string for easier reading
          console.log(value);
        //   const text = new TextDecoder().decode(value);
        //   console.log("Received from UART:", text);
  
          // You can process the text here, e.g., parse data or trigger events
        }
      }
    } catch (error) {
      console.error("Error reading from serial port:", error);
    } finally {
      //reader.releaseLock();
    }
  }
  

function sineMove(ax){

    if (motorOn) {
        let message = '';
        // console.log('sineFrq' + ax + '-input');
        const sineFrq = document.getElementById('sineFrq' + ax + '-input').value;
        const sineAmp = document.getElementById('sineAmp' + ax + '-input').value;
        const trAng = document.getElementById('ang' + ax + '-input').value;
        if (ax == 'Tr'){
            message = `R1[13]=${10*sineFrq}; R1[14]=${10*sineAmp}; R1[15]=${trAng}; R1[1]=3`;
        } else {
            message = `R1[23]=${10*sineFrq}; R1[24]=${10*sineAmp}; R1[25]=${trAng}; R1[1]=3`;
        }
        console.log(message);
        sendMsg(message);
    } else {
        alert('Motors are off, \nPlease turn on motors first');
    }
}

function bombMsgs() {
    // Send velocity command at 50Hz (20ms interval) for 4 seconds
    intervalMove = setInterval(() => {
        sendMsg(velCmd(5,1));
    }, 20);

    // Stop after 4 seconds
    setTimeout(() => {
        clearInterval(intervalMove);
    }, 4000);
}

function playTune() {

    if (motorOn) {
        let message = 'R1[1]=8';
        sendMsg(message);
    } else {
        alert('Motors are off, \nPlease turn on motors first');
    }
}

function joystickCmd(direction) {
    playLocalTone();
    console.log(direction);

    switch (direction) {
        case "UP":
            joystickEl++;
            break;

        case "DOWN":
            joystickEl--;
            break;

        case "RIGHT":
            joystickTr++;
            break;

        case "LEFT":
            joystickTr--;
            break;

        case "CENTER":
            joystickTr = 0;
            joystickEl = 0;
    }
    //console.log(`Joystick TR = ${joystickTr}, EL = ${joystickEl}`);
    let message = `R1[12]=${joystickTr}; R1[22]=${joystickEl}`;
    console.log(message);
    sendMsg(message);
}


function playLocalTone() {
    const audioElement = document.getElementById('localAudio');
    audioElement.play();
}

function runRecord() {
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt';

    // Trigger file selection dialog
    fileInput.click();

    // Handle file selection
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            console.log('File contents:', text);
            // Process text file contents here
            
        } catch (error) {
            console.error('Error reading file:', error);
        }
    });
    // Handle file selection
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const lines = text.split('\n');
            
            // Filter only XCD2 OUT messages first
            const outMessages = lines
                .filter(line => line.includes('XCD2 OUT'))
                .map(line => {
                    const dataMatch = line.match(/Data: (.*)/);
                    if (dataMatch) {
                        const hexValues = dataMatch[1].trim().split(' ');
                        return hexValues.map(hex => parseInt(hex, 16));
                    }
                    return null;
                })
                .filter(msg => msg !== null);

            // Send messages at 30Hz (approximately 33.33ms between messages)
            const interval = 1000 / 50; // 20ms
            
            for (let i = 0; i < outMessages.length; i += 2) {
                // Log message count every 10 messages
                if (i % 20 === 0) {
                    console.log(`Processing messages ${i}-${Math.min(i+19, outMessages.length-1)}`);
                }

                // Send first message
                await sendMsg(outMessages[i], envelope=false);
                const resp1 = await readMsg(outMessages[i]);
                
                // Send second message if it exists
                if (i + 1 < outMessages.length) {
                    await sendMsg(outMessages[i+1], envelope=false);
                    const resp2 = await readMsg(outMessages[i+1]);
                }

                await new Promise(resolve => setTimeout(resolve, interval));

                if (!window.responses) {
                    window.responses = [];
                }
                if (resp1) {
                    window.responses.push(resp1);
                }
                if (typeof resp2 !== 'undefined' && resp2) {
                    window.responses.push(resp2);
                }
                
                // After last messages, save responses to file
                if (i >= outMessages.length - 2) {
                    console.log('lastMsg');
                    const blob = new Blob([window.responses.join('\n')], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'responses.txt';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    window.responses = []; // Clear responses array
                }
            }

        } catch (error) {
            console.error('Error reading file:', error);
        }
    });
}

function moveCmd(ang,ax){

    let msg = [8,5,2];
    msg.push(...get4Bytes(ang));
    msg.push(ax);

    return msg;
}

function velCmd(ang,ax){

    let msg = [8,5,3];
    msg.push(...get4Bytes(ang));
    msg.push(ax);

    return msg;
}

function setV0(cmd){
    let msg = [9,6,6,232,3]; // Set V0
    msg.push(...get4Bytes(cmd));

    return msg;
}


const get4Bytes = (number) => Array.from(new Uint8Array(new Float32Array([number]).buffer));

