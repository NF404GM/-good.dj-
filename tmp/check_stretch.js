import SignalsmithStretch from 'signalsmith-stretch';
const result = await SignalsmithStretch();
console.log('Result of SignalsmithStretch():', result);
if (result) {
    console.log('Constructors/Methods:', Object.keys(result));
}
