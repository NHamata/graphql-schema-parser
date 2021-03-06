/* Parses a GraphQL schema that has its directives encoded, creates all the types recognized by the spec */
import { ScalarDefinition } from '../typedefs/base-type'
import { DescribableParameterComponent, DirectiveAnnotation, InputFieldDefinition, NamedComponent, NameIndex, ParameterFieldDefinition } from '../typedefs/component'
import { DirectiveDefinition, DirectiveDefinitionElement, EnumDefinition, EnumElement, UnionDefinition, UnionElement } from '../typedefs/element-definition'
import { InputDefinition, InterfaceDefinition, ObjectDefinition } from '../typedefs/fielded-type'
import { getDirectiveProperties, ENCODING_FLAG } from './graphql-directive-parser'

/************************************************START OF ALL REGEXP COMPONENTS************************************************/
/*All regexp components must have match groups according to the group that has the same name with suffix "_GROUPS"

/* Suffix used to denote a type that has been extended. Since extended objects do not have their own unique name, to avoid clashing key names, this suffix was requried*/
const EXTENSION_NAME_SUFFIX = '_isExtended_'

/* Regexp that is reused for matching field descriptions */
/* Unescaped Regexp, useful for debugging*/
/* (\s*"""([^"]+)"""\s*){0,1} */
const FIELD_DESCRIPTION = '\(\\s*"""\(\[^"\]+\)"""\\s*\)\{0,1\}'

/* Regexp that is reused for matching field parameter descriptions */
/* Unescaped Regexp, useful for debugging*/
/* (\s*"([^"]+)"\s*){0,1} */
const PARAMETER_DESCRIPTION = '\(\\s*"\(\[^"\]+\)"\\s*\)\{0,1\}'

/* Regexp that is used for matching fielded objects such as an object, interface or input */
/* Unescaped Regexp, useful for debugging*/
/* (\s*"""([^"]+)"""\s*){0,1}^(extend\s+){0,1}(type|interface|input){1}\s+(\w+){1}(\s+implements\s+){0,1}([\s\w&]*)([\s0-9a-zA-Z%]*){0,1}{([^}]+)} */
const OBJECT_REGEXP = new RegExp(FIELD_DESCRIPTION + '^\(extend\\s+\)\{0,1\}\(type|interface|input\)\{1\}\\s+\(\\w+\)\{1\}\(\\s+implements\\s+\)\{0,1\}\(\[\\s\\w&\]*\)\(\[\\s0-9a-zA-Z' + ENCODING_FLAG + '\]*\)\{0,1\}\{\(\[^\}\]+\)\}', 'gm')
/* Group numbers OBJECT_REGEXP for matches */
const OBJECT_REGEXP_GROUPS = {
    DESCRIPTION: 2,
    EXTENDS_TAG: 3,
    TYPE_LABEL: 4,
    NAME: 5,
    IMPLEMENTS_TAG: 6,
    IMPLEMENTS: 7,
    ENCODED_DIRECTIVES: 8,
    BODY: 9,
}

/* Regexp that is used for matching the raw text of the fields of a fielded type such as an object, input or interface */
/* Unescaped Regexp, useful for debugging*/
/* (\s*"""([^"]+)"""\s*){0,1}^[\t ]*(\w+)(\(([^\)]+)\)){0,1}:([\w\t \[\]!]+)[\t ]*($|[%\w \t]+$) */
const FIELD_REGEXP = new RegExp(FIELD_DESCRIPTION + '^\[\\t \]*\(\\w+\)\(\\(\(\[^\\)\]+\)\\)\)\{0,1\}:\(\[\\w\\t \\[\\]!\]+\)\[\\t \]*\($|\[' + ENCODING_FLAG + '\\w \\t\]+$\)', 'gm')
/* Group numbers FIELD_REGEXP for matches */
const FIELD_REGEXP_GROUPS = {
    DESCRIPTION: 2,
    NAME: 3,
    PARAMETERS: 5,
    TYPE: 6,
    ENCODED_DIRECTIVES: 7
}

/* Regexp that is used for matching an the parameters inside the brackets of a field that can contain parameters belonging to a fielded type such as an object or interface  */
/* Unescaped Regexp, useful for debugging*/
/* (\s*"([^"]+)"\s*){0,1}[\t ]*(\w+)[\t ]*(\(([^\)]+)\)){0,1}:([\w\t \[\]!]+)[\t ]*($|[%\w \t]+$|[%\w \t]*,|$) */
const FIELD_PARAMETER_REGEXP = new RegExp(PARAMETER_DESCRIPTION + '\[\\t \]*\(\\w+\)\[\\t \]*\(\\(\(\[^\\)\]+\)\\)\)\{0,1\}:\(\[\\w\\t \\[\\]!\]+\)\[\\t \]*\($|\[' + ENCODING_FLAG + '\\w \\t\]+$|\[' + ENCODING_FLAG + '\\w \\t\]*,|$\)', 'gm')
/* Group numbers FIELD_PARAMETER_REGEXP for matches */
const FIELD_PARAMETER_REGEXP_GROUPS = {
    DESCRIPTION: 2,
    NAME: 3,
    TYPE: 6,
    ENCODED_DIRECTIVES: 7
}

/* Regexp that is used for matching a union type */
/* Unescaped Regexp, useful for debugging*/
/* (\s*"""([^"]+)"""\s*){0,1}^\s*(extend\s+){0,1}union\s+(\w+)\s*([%\sA-Za-z0-9]*)\s*=\s*(\|{0,1}[|\w\s%]+\|\s*\w+[%\w\s]+)$ */
const UNION_REGEXP = new RegExp(FIELD_DESCRIPTION + '^\\s*\(extend\\s+\)\{0,1\}union\\s+\(\\w+\)\\s*\(\[' + ENCODING_FLAG + '\\sA-Za-z0-9\]*\)\\s*=\\s*\(\\|\{0,1\}\[|\\w\\s' + ENCODING_FLAG + '\]+\\|\\s*\\w+\[' + ENCODING_FLAG + '\\w\\s\]+\)$', 'gm');
/* Group numbers UNION_REGEXP for matches */
const UNION_REGEXP_GROUPS = {
    DESCRIPTION: 2,
    EXTENDS_TAG: 3,
    NAME: 4,
    ENCODED_DIRECTIVES: 5,
    UNION_ELEMENTS: 6,
}

/* Regexp that is used for matching a scalar type */
/* Unescaped Regexp, useful for debugging*/
/* (\s*"""([^"]+)"""\s*){0,1}^\s*(extend\s+){0,1}scalar\s+(\w+)\s*([%A-Za-z0-9]*)$ */
const SCALAR_REGEXP = new RegExp(FIELD_DESCRIPTION + '^\\s*\(extend\\s+\)\{0,1\}scalar\\s+\(\\w+\)\\s*\(\[' + ENCODING_FLAG + 'A-Za-z0-9\]*\)$', 'gm')
/* Group numbers SCALAR_REGEXP for matches */
const SCALAR_REGEXP_GROUPS = {
    DESCRIPTION: 2,
    EXTENDS_TAG: 3,
    NAME: 4,
    ENCODED_DIRECTIVES: 5
}

/* Regexp that is used for matching a directive definition type */
/* Unescaped Regexp, useful for debugging*/
/* (\s*"""([^"]+)"""\s*){0,1}^[\t ]*directive\s+[\t ]+([\w%\t ]+)[\t ]+on[\t ]*([\w\s|]*)$ */
const DIRECTIVE_DEFINITION_REGEXP = new RegExp(FIELD_DESCRIPTION + '^\[\\t \]*directive\\s+\[\\t \]+\(\[\\w' + ENCODING_FLAG + '\\t \]+\)\[\\t \]+on\[\\t \]*\(\[\\w\\s|\]*\)$', 'gm')
/* Group numbers DIRECTIVE_DEFINITION_REGEXP for matches */
const DIRECTIVE_DEFINITION_REGEXP_GROUPS = {
    DESCRIPTION: 2,
    DIRECTIVE: 3,
    DIRECTIVE_LOCATIONS: 4
}

/* Regexp that is used for matching enum type */
/* Unescaped Regexp, useful for debugging*/
/* (\s*"""([^"]+)"""\s*){0,1}^\s*(extend\s+){0,1}enum\s+(\w+){1}([%\s\w,:\(\)!\[\]]*){0,1}{([^}]+)} */
const ENUM_REGEXP = new RegExp(FIELD_DESCRIPTION + '^\\s*\(extend\\s+\)\{0,1\}enum\\s+\(\\w+\)\{1\}\(\[' + ENCODING_FLAG + '\\s\\w,:\\(\\)!\\[\\]\]*\)\{0,1\}\{\(\[^\}\]+)\}', 'gm')
/* Group numbers ENUM_REGEXP for matches */
const ENUM_REGEXP_GROUPS = {
    DESCRIPTION: 2,
    EXTENDS_TAG: 3,
    NAME: 4,
    ENCODED_DIRECTIVES: 5,
    ELEMENTS: 6
}
/************************************************END OF ALL REGEXP COMPONENTS************************************************/

/**
 * parses an encoded schema text and build all union types and returns a NameIndex of them 
 * @param encodedDirectivesSchemaText the text string of a schema whose root directives have all been encoded
 * @param directiveProperties the datastructure containing all the root directives that corresponds to the schema in which the encodedDirectiveComponent text was taken from
 * @returns a name index of all unions in the schema 
 */
const getUnions = (encodedDirectivesSchemaText: string, directiveProperties: NameIndex<DirectiveAnnotation>): NameIndex<UnionDefinition> => {
    const unionMatches = [...encodedDirectivesSchemaText.matchAll(UNION_REGEXP)]
    const results: NameIndex<UnionDefinition> = {}
    unionMatches.forEach((unionMatch) => {
        let elements: NameIndex<UnionElement> = {}
        unionMatch[UNION_REGEXP_GROUPS.UNION_ELEMENTS]
            .trim()
            .split('|')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .forEach(element => elements[element] = new UnionElement({ name: element }))
        const directives = getDirectiveProperties(unionMatch[UNION_REGEXP_GROUPS.ENCODED_DIRECTIVES].trim(), directiveProperties)
        const isExtended = unionMatch[UNION_REGEXP_GROUPS.EXTENDS_TAG] ? true : false
        const name = isExtended ? unionMatch[UNION_REGEXP_GROUPS.NAME] + EXTENSION_NAME_SUFFIX : unionMatch[UNION_REGEXP_GROUPS.NAME]
        const description = unionMatch[UNION_REGEXP_GROUPS.DESCRIPTION] ? unionMatch[UNION_REGEXP_GROUPS.DESCRIPTION].trim() : unionMatch[UNION_REGEXP_GROUPS.DESCRIPTION]
        results[name] = { isExtended, name, elements }
        if (directives) {
            results[name].directives = directives
        }
        if (description) {
            results[name].description = description
        }
    })
    return results;
}

/**
 * parses an encoded schema text and build all union types and returns a NameIndex of them
 * @param encodedDirectivesSchemaText the text string of a schema whose root directives have all been encoded
 * @param directiveProperties the datastructure containing all the root directives that corresponds to the schema in which the encodedDirectiveComponent text was taken from
 * @returns a name index of all scalars in the schema 
 */
const getScalars = (encodedDirectivesSchemaText: string, directiveProperties: NameIndex<DirectiveAnnotation>): NameIndex<ScalarDefinition> => {
    const scalarMatches = [...encodedDirectivesSchemaText.matchAll(SCALAR_REGEXP)]
    const results: NameIndex<ScalarDefinition> = {}
    scalarMatches.forEach((scalarMatch) => {
        const directives = getDirectiveProperties(scalarMatch[SCALAR_REGEXP_GROUPS.ENCODED_DIRECTIVES].trim(), directiveProperties)
        const description = scalarMatch[SCALAR_REGEXP_GROUPS.DESCRIPTION] ? scalarMatch[SCALAR_REGEXP_GROUPS.DESCRIPTION].trim() : scalarMatch[SCALAR_REGEXP_GROUPS.DESCRIPTION]
        const isExtended = scalarMatch[SCALAR_REGEXP_GROUPS.EXTENDS_TAG] ? true : false
        const name = isExtended ? scalarMatch[SCALAR_REGEXP_GROUPS.NAME] + EXTENSION_NAME_SUFFIX : scalarMatch[SCALAR_REGEXP_GROUPS.NAME]
        results[name] = { name, isExtended }
        if (directives) {
            results[name].directives = directives
        }
        if (description) {
            results[name].description = description
        }
    })
    return results;
}

/**
 * parses an encoded schema text and build all directive definition types and returns a NameIndex of them
 * @param encodedDirectivesSchemaText the text string of a schema whose root directives have all been encoded
 * @param directiveProperties the datastructure containing all the root directives that corresponds to the schema in which the encodedDirectiveComponent text was taken from
 * @returns a name index of all directive definitions in the schema 
 */
const getDirectiveDefinitions = (encodedDirectivesSchemaText: string, directiveProperties: NameIndex<DirectiveAnnotation>): NameIndex<DirectiveDefinition> => {
    const directiveDefinitionMatches = [...encodedDirectivesSchemaText.matchAll(DIRECTIVE_DEFINITION_REGEXP)]
    const results: NameIndex<DirectiveDefinition> = {}
    directiveDefinitionMatches.forEach((directiveDefinitionMatch) => {
        const directiveId = directiveDefinitionMatch[DIRECTIVE_DEFINITION_REGEXP_GROUPS.DIRECTIVE].trim()
        const directive = directiveProperties[directiveId]
        const name = directive.name
        const parameters = directive.parameters
        const description = directiveDefinitionMatch[DIRECTIVE_DEFINITION_REGEXP_GROUPS.DESCRIPTION]
        const isExtended = false
        let elements: NameIndex<DirectiveDefinitionElement> = {}
        directiveDefinitionMatch[DIRECTIVE_DEFINITION_REGEXP_GROUPS.DIRECTIVE_LOCATIONS]
            .split('|')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .forEach((directiveLocationField) => {
                try {
                    elements[directiveLocationField] = new DirectiveDefinitionElement({ name: directiveLocationField })
                } catch (e) {
                    console.log(e)
                }
            })
        results[name] = { name, elements, isExtended }
        if (description) {
            results[name].description = description.trim()
        }
        if (parameters) {
            results[name].parameters = parameters
        }

    })
    return results;
}

/**
 * parses an encoded schema text and build all types which contain fields which are: object, inputs and interface types and returns a NameIndex of them.
 * Since the regex is so similar between the three all of the parsing was done on this function.
 * @param encodedDirectivesSchemaText the text string of a schema whose root directives have all been encoded
 * @param directiveProperties the datastructure containing all the root directives that corresponds to the schema in which the encodedDirectiveComponent text was taken from
 * @returns a name index of all fielded types which are objects, interfaces and inputs in the schema 
 */
const getFieldedTypes = (encodedDirectivesSchemaText: string, directiveProperties: NameIndex<DirectiveAnnotation>): {
    objects?: NameIndex<ObjectDefinition>,
    interfaces?: NameIndex<InterfaceDefinition>,
    inputs?: NameIndex<InputDefinition>,
} => {
    const typeMatches = [...encodedDirectivesSchemaText.matchAll(OBJECT_REGEXP)]
    typeMatches.forEach(typeMatch => delete typeMatch.input)
    let results: {
        objects?: NameIndex<ObjectDefinition>,
        interfaces?: NameIndex<InterfaceDefinition>,
        inputs?: NameIndex<InputDefinition>,
    } = {};
    let objectsResult = new NameIndex<ObjectDefinition>()
    let interfacesResult = new NameIndex<InterfaceDefinition>()
    let inputsResult = new NameIndex<InputDefinition>()
    typeMatches.forEach((match) => {
        let typeLabel = match[OBJECT_REGEXP_GROUPS.TYPE_LABEL];
        let type: "objects" | "interfaces" | "inputs";
        let result: ObjectDefinition | InterfaceDefinition | InputDefinition;
        const encodedDirectives = match[OBJECT_REGEXP_GROUPS.ENCODED_DIRECTIVES]
        const isExtended = match[OBJECT_REGEXP_GROUPS.EXTENDS_TAG] ? true : false
        const name = isExtended ? match[OBJECT_REGEXP_GROUPS.NAME] + EXTENSION_NAME_SUFFIX : match[OBJECT_REGEXP_GROUPS.NAME]
        const interfaces = match[OBJECT_REGEXP_GROUPS.IMPLEMENTS]
        const rawTextFields = match[OBJECT_REGEXP_GROUPS.BODY]
        const description = match[OBJECT_REGEXP_GROUPS.DESCRIPTION]
        if (name && typeLabel && rawTextFields) {
            if (typeLabel === 'input') {
                result = new InputDefinition({ name, isExtended })
                result.fields = getInputFieldProperties(rawTextFields, directiveProperties)
            } else if (typeLabel === 'interface') {
                result = new InterfaceDefinition({ name, isExtended })
                result.fields = getParameterFieldProperties(rawTextFields, directiveProperties)
            } else {
                let object = new ObjectDefinition({ name, isExtended })
                if (interfaces && interfaces.length > 0) {
                    let implementations = new NameIndex<NamedComponent>();
                    interfaces
                        .split('&')
                        .map(anInterface => anInterface.trim())
                        .filter(anInterface => anInterface.length > 0)
                        .map(anInterface => new NamedComponent({ name: anInterface }))
                        .forEach(interfaceComponent => implementations[interfaceComponent.name] = interfaceComponent)
                    if (Object.keys(implementations).length > 0) {
                        object.implements = implementations
                    }

                }
                let fields = getParameterFieldProperties(rawTextFields, directiveProperties)
                if (Object.keys(fields).length > 0) {
                    object.fields = fields
                }
                result = object
            }
            if (description) {
                result.description = description.trim();
            }

            if (encodedDirectives) {
                result.directives = getDirectiveProperties(encodedDirectives, directiveProperties)
            }

            if (result instanceof ObjectDefinition) {
                objectsResult[result.name] = result
            } else if (result instanceof InterfaceDefinition) {
                interfacesResult[result.name] = result
            } else if (result instanceof InputDefinition) {
                inputsResult[result.name] = result
            }
        }
    })
    results.objects = objectsResult;
    results.interfaces = interfacesResult;
    results.inputs = inputsResult;
    return results
}

/**
 * parses an FIELD_REGEXP_GROUPS.PARAMETERS which is the text inside the parameter brackets of a field (for an object or interface type), parses them and creates an index of
 * these parameter objects. These parameters can also have descriptions 
 * @param rawParametersText the text string inside the parameters brackets of a field (that can contain parameters, which are objects and interfaces)
 * @param directiveProperties the datastructure containing all the root directives that corresponds to the schema in which the encodedDirectiveComponent text was taken from
 * @returns a name index of all parameters of a field from a type in the schema 
 */
const getParameterProperties = (rawParametersText: string, directiveProperties: NameIndex<DirectiveAnnotation>): NameIndex<DescribableParameterComponent> => {
    const matches = [...rawParametersText.matchAll(FIELD_PARAMETER_REGEXP)]
    let results: NameIndex<DescribableParameterComponent> = {}
    matches
        .forEach((match) => {
            const name = match[FIELD_PARAMETER_REGEXP_GROUPS.NAME]
            const type = match[FIELD_PARAMETER_REGEXP_GROUPS.TYPE]
            const directives = match[FIELD_PARAMETER_REGEXP_GROUPS.ENCODED_DIRECTIVES]
            const description = match[FIELD_PARAMETER_REGEXP_GROUPS.DESCRIPTION]
            if (name && type) {
                results[name] = new DescribableParameterComponent({ name, type })
                if (description) {
                    results[name].description = description.trim()
                }
                if (directives) {
                    results[name].directives = getDirectiveProperties(directives, directiveProperties)
                }
            }
        })
    return results
}

/**
 * parses an OBJECT_REGEXP_GROUPS.BODY which is the fields of an object or interface type as text and build all fields returns a NameIndex of them. These fields have optional parameters
 * @param rawTextFields the text string of all the fields that can have parameters of an individual type from the schema, these types are objects and interfaces
 * @param directiveProperties the datastructure containing all the root directives that corresponds to the schema in which the encodedDirectiveComponent text was taken from
 * @returns a name index of all fields of a types from the schema that can contain parameters in their fields
 */
const getParameterFieldProperties = (rawTextFields: string, directiveProperties: NameIndex<DirectiveAnnotation>): NameIndex<ParameterFieldDefinition> => {
    let results: NameIndex<ParameterFieldDefinition> = new NameIndex<ParameterFieldDefinition>()
    const matches = [...rawTextFields.matchAll(FIELD_REGEXP)]
    matches
        .forEach((match) => {
            const name = match[FIELD_REGEXP_GROUPS.NAME].trim()
            const type = match[FIELD_REGEXP_GROUPS.TYPE].trim()
            const directives = match[FIELD_REGEXP_GROUPS.ENCODED_DIRECTIVES]
            const parameters = match[FIELD_REGEXP_GROUPS.PARAMETERS]
            const description = match[FIELD_REGEXP_GROUPS.DESCRIPTION]

            if (name && type) {
                results[name] = { name, type }
                if (description && description.length > 0) {
                    results[name].description = description.trim()
                }
                if (directives && directives.length > 0) {
                    results[name].directives = getDirectiveProperties(directives, directiveProperties)
                }
                if (parameters && parameters.length > 0) {
                    results[name].parameters = getParameterProperties(parameters, directiveProperties)
                }
            }
        })
    return results
}

/**
 * parses an OBJECT_REGEXP_GROUPS.BODY which is the fields of an input type as text and builds all fields returns a NameIndex of them. These fields cannot have parameters 
 * @param rawTextFields the text string of all the fields that CANNOT have parameters of an individual type from the schema, these types are inputs
 * @param directiveProperties the datastructure containing all the root directives that corresponds to the schema in which the encodedDirectiveComponent text was taken from
 * @returns a name index of all fields of a types from the schema that CANNOT contain parameters in their fields, these types are inputs
 */
const getInputFieldProperties = (rawTextFields: string, directiveProperties: NameIndex<DirectiveAnnotation>): NameIndex<InputFieldDefinition> => {
    let results: NameIndex<InputFieldDefinition> = {}
    const matches = [...rawTextFields.matchAll(FIELD_REGEXP)]
    matches
        .forEach((match) => {
            const name = match[FIELD_REGEXP_GROUPS.NAME]
            const type = match[FIELD_REGEXP_GROUPS.TYPE]
            const directives = match[FIELD_REGEXP_GROUPS.ENCODED_DIRECTIVES]
            const description = match[FIELD_REGEXP_GROUPS.DESCRIPTION]
            if (name && type) {
                results[name] = { name, type }
                if (description && description.length > 0) {
                    results[name].description = description.trim();
                }
                if (directives && directives.length > 0) {
                    results[name].directives = getDirectiveProperties(directives, directiveProperties)
                }
            }
        })
    return results
}

/**
 * parses an encoded schema text and build all enum types and returns a NameIndex of them
 * @param encodedDirectivesSchemaText the text string of a schema whose root directives have all been encoded
 * @param directiveProperties the datastructure containing all the root directives that corresponds to the schema in which the encodedDirectiveComponent text was taken from
 * @returns a name index of all enums in the schema 
 */
const getEnums = (encodedDirectivesSchemaText: string, directiveProperties: NameIndex<DirectiveAnnotation>): NameIndex<EnumDefinition> => {
    let results = new NameIndex<EnumDefinition>();
    const enumMatches = [...encodedDirectivesSchemaText.matchAll(ENUM_REGEXP)]
    enumMatches.forEach(typeMatch => delete typeMatch.input)
    enumMatches.forEach((match) => {
        const isExtended = match[ENUM_REGEXP_GROUPS.EXTENDS_TAG] ? true : false
        const name = isExtended ? match[ENUM_REGEXP_GROUPS.NAME] + EXTENSION_NAME_SUFFIX : match[ENUM_REGEXP_GROUPS.NAME]
        const directives = match[ENUM_REGEXP_GROUPS.ENCODED_DIRECTIVES]
        const elements = getEnumElements(match[ENUM_REGEXP_GROUPS.ELEMENTS], directiveProperties)
        const description = match[ENUM_REGEXP_GROUPS.DESCRIPTION] ? match[ENUM_REGEXP_GROUPS.DESCRIPTION].trim() : match[ENUM_REGEXP_GROUPS.DESCRIPTION]
        if (name && Object.keys(elements).length > 0) {
            results[name] = { name, elements, isExtended }
            if (description && description.length > 0) {
                results[name].description = description.trim();
            }
            if (directives && directives.length > 0) {
                results[name].directives = getDirectiveProperties(directives, directiveProperties)
            }
        }
    })
    return results;
}

/**
 * parses ENUM_REGEXP_GROUPS.ELEMENTS encoded schema text and build all union elements and returns a NameIndex of them
 * @param rawEnumValuesText the text string of a the elements listed in an enum
 * @param directiveProperties the datastructure containing all the root directives that corresponds to the schema in which the encodedDirectiveComponent text was taken from
 * @returns a name index of all enum elements belonging to an enum in the schema
 */
const getEnumElements = (rawEnumValuesText: string, directiveProperties: NameIndex<DirectiveAnnotation>): NameIndex<EnumElement> => {
    let results = new NameIndex<EnumElement>();
    rawEnumValuesText
        .split('\n')
        .filter(line => line.length > 0)
        .map(line => line.trim())
        .forEach((line) => {
            const name = line.includes(ENCODING_FLAG) ? (line.split(ENCODING_FLAG))[0].trim() : line.trim()
            results[name] = { name }
            if (line.includes(ENCODING_FLAG)) {
                const directives = getDirectiveProperties(line, directiveProperties)
                if (Object.keys(directives).length > 0) {
                    results[name].directives = directives
                }
            }

        })
    return results
}

export {
    getEnums,
    getFieldedTypes,
    getDirectiveDefinitions,
    getScalars,
    getUnions,
}