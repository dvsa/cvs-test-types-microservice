import { HTTPError } from "../models/HTTPError";
import TestTypesDAO from "../models/TestTypesDAO";
import {ITestType, TestCode} from "../models/ITestType";
import {ERRORS, HTTPRESPONSE} from "../assets/Enums";

export class TestTypesService {
    public readonly testTypesDAO: TestTypesDAO;

    constructor(testTypesDAO: TestTypesDAO) {
        this.testTypesDAO = testTypesDAO;
    }

    public getTestTypesList() {
        return this.testTypesDAO.getAll()
            .then((data) => {
                if (data.Count === 0) {
                    throwResourceNotFound();
                }

                this.purgeTestTypes(data.Items);
                return this.sort(data.Items);
            })
            .catch((error) => {
                if (!(error instanceof HTTPError)) {
                    console.error(error);
                    error.statusCode = 500;
                    error.body = "Internal Server Error";
                }

                throw new HTTPError(error.statusCode, error.body);
            });
    }

    public getTestTypesById(id: string, filterExpression: any) {
        return this.testTypesDAO.getAll()
            .then((data) => {
                if (data.Count === 0) {
                    throwResourceNotFound();
                }

                return data.Items;
            })
            .then((testTypes) => {
                return this.findTestType({ id, testTypes });
            })
            .then((testType) => {
                if (testType === null) {
                    throwResourceNotFound();
                }
                let testCodes: TestCode[] = testType.testCodes;

                testCodes = testCodes.filter((testCode) => { // filter by vehicleType if present in DB, otherwise skip
                    return testCode.forVehicleType ? testCode.forVehicleType === filterExpression.vehicleType : true;
                }).filter((testCode) => { // filter by vehicleSize if present in DB & in request, otherwise skip
                    return (testCode.forVehicleSize && filterExpression.vehicleSize) ? this.fieldInfilterExpressionMatchesTheOneInTestCode(testCode, filterExpression, "forVehicleSize") : true;
                }).filter((testCode) => { // filter by vehicleConfiguration if present in DB & in request, otherwise skip
                    return (testCode.forVehicleConfiguration && filterExpression.vehicleConfiguration) ? this.fieldInfilterExpressionMatchesTheOneInTestCode(testCode, filterExpression, "forVehicleConfiguration") : true;
                }).filter((testCode) => { // filter by vehicleAxles if present in DB & in request, otherwise skip
                    return (testCode.forVehicleAxles && filterExpression.vehicleAxles) ? this.fieldInfilterExpressionMatchesTheOneInTestCode(testCode, filterExpression, "forVehicleAxles") : true;
                }).filter((testCode) => {
                    return (testCode.forEuVehicleCategory && filterExpression.euVehicleCategory) ? this.fieldInfilterExpressionMatchesTheOneInTestCode(testCode, filterExpression, "forEuVehicleCategory") : true;
                }).filter((testCode) => {
                    return (testCode.forVehicleClass && filterExpression.vehicleClass) ? this.fieldInfilterExpressionMatchesTheOneInTestCode(testCode, filterExpression, "forVehicleClass") : true;
                }).filter((testCode) => {
                    return (testCode.forVehicleSubclass && filterExpression.vehicleSubclass) ? this.fieldInfilterExpressionMatchesTheOneInTestCode(testCode, filterExpression, "forVehicleSubclass") : true;
                }).filter((testCode) => {
                    return (testCode.forVehicleWheels && filterExpression.vehicleWheels) ? this.fieldInfilterExpressionMatchesTheOneInTestCode(testCode, filterExpression, "forVehicleWheels") : true;
                });

                if (testCodes.length === 0) {
                    throwResourceNotFound();
                }

                if (testCodes.length > 1) {
                    console.error("More than one testType was retrieved");
                    throwInternalServerError();
                }

                const response: any = {
                    id: testType.id
                };

                filterExpression.fields // Iterate through filterExpression's fields and populate them in the response
                    .forEach((field: keyof TestCode) => {
                        response[field] = testCodes[0][field];
                    });

                // Populating testTypeClassification that is found in testType, not testCode
                if (filterExpression.fields.includes("testTypeClassification")) {
                    response.testTypeClassification = testType.testTypeClassification;
                }
                return response;
            });
    }

    /**
     * returns null if the test-type was not found
     * @param id
     * @param testTypes
     */
    public findTestType({ id, testTypes }: { id: string; testTypes: any; }) {
        for (const testType of testTypes) {
            // for (let i = 0; i < testTypes.length; i++) {
            //   const testType: any = testTypes[i];
            if (testType.hasOwnProperty("nextTestTypesOrCategories")) {
                const childrenTestType: any = this.findTestType({ id, testTypes: testType.nextTestTypesOrCategories });

                if (childrenTestType != null) {
                    return childrenTestType;
                }
            } else if (testType.hasOwnProperty("id") && testType.id === id) {
                return testType;
            }
        }
        return null;
    }

    public sort(testTypes: ITestType[] | any) {
        // Pass by value
        const testTypeArray = testTypes;

        for (const testType of testTypeArray) {
            if (testType.hasOwnProperty("nextTestTypesOrCategories")) {
                Object.assign(testTypeArray, { nextTestTypesOrCategories: this.sort(testType.nextTestTypesOrCategories) });
            }
        }

        return testTypeArray.sort((a: { id: string; }, b: { id: string; }) => parseInt(a.id, 10) - parseInt(b.id, 10));
    }

    public purgeTestTypes(testTypes: ITestType[] | any) {
        for (const testType of testTypes) {
            // for (let i = 0; i < testTypes.length; i++) {
            // const testType = testTypes[i];
            if (testType.hasOwnProperty("nextTestTypesOrCategories")) {
                this.purgeTestTypes(testType.nextTestTypesOrCategories);
            } else if (testType.hasOwnProperty("id")) {
                delete testType.testTypeClassification;
                delete testType.testCodes;
            }
        }
    }

    public insertTestTypesList(testTypesItems: ITestType[] ) {
        return this.testTypesDAO.createMultiple(testTypesItems)
            .then((data) => {
                if (data.UnprocessedItems) {
                    return data.UnprocessedItems;
                }
            })
            .catch((error) => {
                if (error) {
                    console.error(error);
                    throwInternalServerError();
                }
            });
    }

    public deleteTestTypesList(testTypesItemKeys: any ) {
        return this.testTypesDAO.deleteMultiple(testTypesItemKeys)
            .then((data) => {
                if (data.UnprocessedItems) {
                    return data.UnprocessedItems;
                }
            })
            .catch((error) => {
                if (error) {
                    console.error(error);
                    throwInternalServerError();
                }
            });
    }

    public fieldInfilterExpressionMatchesTheOneInTestCode(testCode: TestCode, filterExpression: any, field: string) {
        let bool = false;
        const filterOnField = (filterVal: string) => {
            if (Array.isArray(testCode[filterVal])) {
                testCode[filterVal].map((arrayElement: any) => {
                    if (arrayElement === filterExpression[getFilterFieldWithoutFor(filterVal)]) {
                        bool = true;
                    }
                });
            } else {
                bool = testCode[filterVal] === filterExpression[getFilterFieldWithoutFor(filterVal)];
            }
        };

        const getFilterFieldWithoutFor = (filterVal: any) => {
            const rightLetters = filterVal.slice(3); // cut off the leading "for", but still got a capital letter leading
            return rightLetters[0].toLowerCase() + rightLetters.slice(1); // switch first letter to lower case, and rejoin with rest of string
        };

        switch (field) {
            case "forVehicleSize":
            case "forVehicleConfiguration":
            case "forVehicleAxles":
            case "forEuVehicleCategory":
            case "forVehicleClass":
            case "forVehicleSubclass":
            case "forVehicleWheels":
                filterOnField(field);
                break;
            case "forEuVehicleCategory":
                if (Array.isArray(testCode.forEuVehicleCategory)) {
                    testCode.forEuVehicleCategory.map((arrayElement) => {
                        if (arrayElement === filterExpression.euVehicleCategory) {
                            bool = true;
                        }
                    });
                } else {
                    bool = testCode.forEuVehicleCategory === filterExpression.euVehicleCategory;
                }
                break;
            case "forVehicleClass":
                if (Array.isArray(testCode.forVehicleClass)) {
                    testCode.forVehicleClass.map((arrayElement) => {
                        if (arrayElement === filterExpression.vehicleClass) {
                            bool = true;
                        }
                    });
                } else {
                    bool = testCode.forVehicleClass === filterExpression.vehicleClass;
                }
                break;
            case "forVehicleSubclass":
                if (Array.isArray(testCode.forVehicleSubclass)) {
                    testCode.forVehicleSubclass.map((arrayElement) => {
                        if (arrayElement === filterExpression.vehicleSubclass) {
                            bool = true;
                        }
                    });
                } else {
                    bool = testCode.forVehicleSubclass === filterExpression.vehicleSubclass;
                }
                break;
            case "forVehicleWheels":
                if (Array.isArray(testCode.forVehicleWheels)) {
                    testCode.forVehicleWheels.map((arrayElement) => {
                        if (arrayElement === filterExpression.vehicleWheels) {
                            bool = true;
                        }
                    });
                } else {
                    bool = testCode.forVehicleWheels === filterExpression.vehicleWheels;
                }
                break;
            default:
                console.error("Field you filtered by does not exist");
                throwInternalServerError();
        }

        return bool;
    }
}

const throwResourceNotFound = () => {
    throw new HTTPError(404, HTTPRESPONSE.RESOURCE_NOT_FOUND);
};

const throwInternalServerError = () => {
    throw new HTTPError(500, ERRORS.InternalServerError);
};
