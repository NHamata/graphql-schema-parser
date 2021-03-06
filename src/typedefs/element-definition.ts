/* Types that contain a list of elements, such as enum, union, directive definition */

import { DirectiveAnnotation, NameIndex, NamedComponent, NamedComponentAttrs, ParameterComponent } from './component';
import {  SchemaTypeDefinition, SchemaTypeDefinitionAttrs } from './base-type';

abstract class ElementCollection<TYPE extends Element> extends SchemaTypeDefinition{
    elements:NameIndex<TYPE>;

    constructor(elementCollectionAttrs:ElementCollectionAttrs<TYPE>){
        super(elementCollectionAttrs)
        this.elements=elementCollectionAttrs.elements?elementCollectionAttrs.elements:new NameIndex<TYPE>();
    }
}

interface ElementCollectionAttrs<TYPE extends Element> extends SchemaTypeDefinitionAttrs{
    elements:NameIndex<TYPE>;
}


abstract class Element extends NamedComponent{  
    constructor(elementAttrs:ElementAttrs){
        super(elementAttrs)
    }
}

interface ElementAttrs extends NamedComponentAttrs{

}

abstract class DirectibleElementCollection<TYPE extends Element> extends ElementCollection<TYPE>{
    directives?: NameIndex<DirectiveAnnotation>;

    constructor(directibleElementCollectionAttrs:DirectibleElementCollectionAttrs<TYPE>){
        super(directibleElementCollectionAttrs)
        if(directibleElementCollectionAttrs.directives && Object.keys(directibleElementCollectionAttrs.directives).length>0){
            this.directives=directibleElementCollectionAttrs.directives;
        }
        this.isExtended=false;

    }
}

interface DirectibleElementCollectionAttrs<TYPE extends Element> extends ElementCollectionAttrs<TYPE>{
    directives?: NameIndex<DirectiveAnnotation>;
}

abstract class DirectibleElement extends Element{
    directives?: NameIndex<DirectiveAnnotation>;
    constructor(directibleElementAttrs:DirectibleElementAttrs){
        super(directibleElementAttrs)
        if(directibleElementAttrs.directives && Object.keys(directibleElementAttrs.directives).length>0){
            this.directives=directibleElementAttrs.directives;
        }
        
    }
}

interface DirectibleElementAttrs extends ElementAttrs{
    directives?: NameIndex<DirectiveAnnotation>;
}

class EnumDefinition extends DirectibleElementCollection<EnumElement>{

}
class EnumElement extends DirectibleElement{

}

class UnionElement extends DirectibleElement{

}

class UnionDefinition extends DirectibleElementCollection<UnionElement>{

}

class DirectiveDefinition extends ElementCollection<DirectiveDefinitionElement>{
    parameters?:NameIndex<ParameterComponent>;
    constructor(directiveDefinitionAttrs:DirectiveDefinitionAttrs){
        super(directiveDefinitionAttrs);
        if(directiveDefinitionAttrs.parameters && Object.keys(directiveDefinitionAttrs.parameters).length>0){
            this.parameters=directiveDefinitionAttrs.parameters;
        }
    }
}

interface DirectiveDefinitionAttrs extends ElementCollectionAttrs<DirectiveDefinitionElement>{
    parameters?:NameIndex<ParameterComponent>;
}

class DirectiveDefinitionElement extends Element{
    constructor(elementAttrs:ElementAttrs){
        super(elementAttrs)
        if(!(elementAttrs.name in ExecutableDirectiveLocationsEnum) && !(elementAttrs.name in TypeSystemDirectiveLocationsEnum)){
            throw new Error(`The element name \'${elementAttrs.name}\' cannot be added a since it is not listed in enums, ExecutableDirectiveLocationsEnum or TypeSystemDirectiveLocationsEnum`)
        }
    }
}

enum ExecutableDirectiveLocationsEnum{
    QUERY='QUERY',
    MUTATION='MUTATION',
    SUBSCRIPTION='SUBSCRIPTION',
    FIELD='FIELD',
    FRAGMENT_DEFINITION='FRAGMENT_DEFINITION',
    FRAGMENT_SPREAD='FRAGMENT_SPREAD',
    INLINE_FRAGMENT='INLINE_FRAGMENT'
}

enum TypeSystemDirectiveLocationsEnum{
    SCHEMA='SCHEMA',
    SCALAR='SCALAR',
    OBJECT='OBJECT',
    FIELD_DEFINITION='FIELD_DEFINITION',
    ARGUMENT_DEFINITION='ARGUMENT_DEFINITION',
    INTERFACE='INTERFACE',
    UNION='UNION',
    ENUM='ENUM',
    ENUM_VALUE='ENUM_VALUE',
    INPUT_OBJECT='INPUT_OBJECT',
    INPUT_FIELD_DEFINITION='INPUT_FIELD_DEFINITION',
}


export{
    EnumDefinition,
    EnumElement,
    UnionDefinition,
    UnionElement,
    DirectiveDefinition,
    DirectiveDefinitionElement,
    DirectiveDefinitionAttrs,
    ExecutableDirectiveLocationsEnum,
    TypeSystemDirectiveLocationsEnum,
}