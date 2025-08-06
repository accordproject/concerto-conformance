# Concerto Conformance Contribution Guide      
## 1. To add new semantic rules:    
a. Add the model file (.cto) within the specification folder under the suitable specification type.     
b. Add the scenario in the {specification_type}.feature file using the steps statement mentioned in the steps file.    
c. Run the script `npm run convert-ast file_path`    
d. If the cto file is syntactically valid a .json file will be created after running the above script just in the same directory as the corresponding .cto file.    
e. If the cto file is syntactically invalid then no .json file will be created and the steps file will consider it as an invalid model.

## 2. To modify the semantic rules:    
a. To change the scenario you must change the scenario according to the statements in the steps file.    
b. If creating a new step then ensure it's working correctly!   

#### We'd love for you to contribute to our source code and to make Concerto Conformance Test Suite more robust and accurate!