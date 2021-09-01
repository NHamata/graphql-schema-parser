import { rawSchemaText } from './fixtures/raw-schema-text'
import { expectedSchemaObject } from './fixtures/expected-schema-object'
import { generateSchemaObject } from '../ts-parser/graphql-schema-parser'
import { Console } from 'console'



it('generates a schema object with all the expected properties and values', () => {
    compareSchemaObjects(expectedSchemaObject, generateSchemaObject(rawSchemaText, 'test-schema'))
    // console.log('FINALL',compareSchemaObjects(expectedSchemaObject, generateSchemaObject(rawSchemaText, 'test-schema')))
})

//precondition, none
const compareSchemaObjects = (expectedSchemaObject: any, actualSchemaObject: any): {isEqual:boolean,reason?:string,expected:any,actual:any} => {

    let {stringProperties:expectedStringProperties,  objectProperties:expected}=splitStringProperties(expectedSchemaObject)
    let {stringProperties:actualStringProperties,  objectProperties:actual}=splitStringProperties(actualSchemaObject)
    let result = true;
    // console.log('actuall', actual)
    // console.log('expectedd', expected)
    // console.log('expectedStringPropertiess', expectedStringProperties)
    // console.log('actualStringPropertiess', actualStringProperties)

    // console.log('expected',getKeys(expected))
    // console.log('actual',getKeys(actual))
    // console.log('expected',getKeys(expected))
    // console.log('actualStringProperties',getKeys(actualStringProperties))
    
    // // base case: all properties is a string and are they equal
    //(getKeys(actual).length === 0) && (getKeys(expected).length === 0)
    console.log('actualactualactual', getKeys(actual))
    console.log('expectedexpectedexpected', getKeys(expected))
    if ((!getKeys(actual) && !getKeys(expected)) ||(getKeys(actual).length===0 && getKeys(expected).length===0)) {
        console.log('procced');
        console.log('expected procced1',expectedStringProperties);
        console.log('actual procced1',actualStringProperties);
        if(isKeyValueArrayEqual(expectedStringProperties,actualStringProperties)) {
            console.log('proc 1 sucess')
            return {isEqual:true,reason:"objects match",expected:{},actual:{}};
        }else{
            return {isEqual:false,reason:"string based properties do not match",expected:expectedStringProperties,actual:actualStringProperties};
        }
        
    }

    // // inductive step:
    //does properties of string match?
    if(!isKeyValueArrayEqual(expectedStringProperties,actualStringProperties)){
        console.log('expectedStringProperties procced1',expectedStringProperties);
        console.log('actualStringProperties procced1',actualStringProperties);
        return {isEqual:false,reason:"string based properties do not match",expected:expectedStringProperties,actual:actualStringProperties};
    }

    //does object property keys match?
    if(!isPropertyNamesEqual(getKeys(actual),getKeys(expected))){
        console.log('procced2');
        return {isEqual:false,reason:"object based properties keys do not match",expected:getKeys(actual),actual:getKeys(expected)};
    }
    //doeds subtree match
    for (const property in expected) {
        let result = compareSchemaObjects(expected[property], actual[property])
        // console.log('expected subbb',expected[property])
        // console.log('actual subbb',actual[property])
        if(!result.isEqual){
            return {isEqual:false,reason:`child properties of key ${property} do not match`,expected:expected[property],actual:actual[property]};
        }else{
            return {isEqual:true,reason:"objects match",expected:{},actual:{}};
        }
    }
    return {isEqual:false,reason:"objects dont match",expected:{},actual:{}};
}

const getKeys=(obj:any):string[]=>{
    let result=[]
    for(const property in obj){
        if(obj[property]){
            result.push(property)
        }
    }
    return result;
}
const isPropertyNamesEqual = (arr1:string[],arr2:string[])=>{
    let result = false;

    for(const arr1Element of arr1){
        if(arr1Element ==='constructor'){
            continue;
        }
        for(const arr2Element of arr2){
            if(arr2Element ==='constructor'){
                continue;
            }
            if(arr1Element===arr2Element){
                result=true;
            }
        }
        if(!result){
            return false;
        }
    }
    for(const arr2Element of arr2){
        if(arr2Element ==='constructor'){
            continue;
        }
        for(const arr1Element of arr1){
            if(arr1Element ==='constructor'){
                continue;
            }
            if(arr2Element===arr1Element){
                result=true;
            }
        }
        if(!result){
            return false;
        }
    }
    if(arr1.length !== arr2.length){
        return false;
    }
    return true;
}
const splitStringProperties = (object:any)=>{
    let stringProperties:{key:string,value:string}[] = []
    let objectProperties:any={}
    for (const property in object) {
        if(property==='constructor' || !object[property]){
            continue;
        }
        if (typeof object[property] === 'string') {
            if(object[property]&& object[property].length>0){
                stringProperties.push({key:property,value:object[property]})
            }
            
        } else {
            //@ts-ignore
            if(object[property]){
                objectProperties[property] = object[property]
            }

        }
    }
    return{
        stringProperties,
        objectProperties
    }
}
const isKeyValueArrayEqual=(    arr1: {key:string,value:string}[], arr2: {key:string,value:string}[])=>{
        
        let result=false

        // are all the elements in arr1 inside of arr2?
        
        for(const arr1Element of arr1){
            if(arr1Element.key==='constructor'){
                continue;
            }
            for(const arr2Element of arr2){
                if(arr2Element.key==='constructor'){
                    continue;
                }
                if(arr1Element.key===arr2Element.key && arr1Element.value===arr2Element.value){
                    result=true;
                }
            }
            if(!result){
                return false;
            }
        }

        // are all the elements in arr2 inside of arr1?
        for(const arr2Element of arr2){
            if(arr2Element.key==='constructor'){
                continue;
            }
            for(const arr1Element of arr1){
                if(arr1Element.key==='constructor'){
                    continue;
                }
                if(arr1Element.key===arr2Element.key && arr1Element.value===arr2Element.value){
                    result=true;
                }
            }
            if(!result){
                return false;
            }
        }

        if(arr1.length!==arr2.length){
            return false;
        }

        return true;
}
// post condition: returns true if matches, else false and the portion that does not match