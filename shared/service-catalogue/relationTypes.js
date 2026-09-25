'use strict';

const definition = require('./relationTypes.json');

const RELATION_TYPES = Object.freeze(definition.types.map((type) => Object.freeze({ ...type })));
const RELATION_TYPE_CODES = Object.freeze(RELATION_TYPES.map((type) => type.code));
const EDITABLE_RELATION_TYPE_CODES = Object.freeze(RELATION_TYPES.filter((type) => type.editable).map((type) => type.code));
const DEPENDENCY_RELATION_TYPE_CODES = Object.freeze(
    RELATION_TYPES.filter((type) => type.category === 'dependency').map((type) => type.code),
);

function getRelationTypeCategory(code) {
    return RELATION_TYPES.find((type) => type.code === code)?.category ?? null;
}

module.exports = {
    RELATION_TYPE_CATEGORIES: Object.freeze([...definition.categories]),
    RELATION_TYPES,
    RELATION_TYPE_CODES,
    EDITABLE_RELATION_TYPE_CODES,
    DEPENDENCY_RELATION_TYPE_CODES,
    getRelationTypeCategory,
};
