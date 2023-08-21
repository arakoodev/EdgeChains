# flyfly CLI
## Installation & Usage
cd to autoroute directory 
```console
mvn clean package -P gofly
```
cd to flyfly directory
```console
mvn clean package -P gofly
```
Now cd into Examples/starter :- flyfly is ready to roll!
```bash
java -jar flyfly.jar <command>
```

## Commands 

### run  
Runs the Spring Boot application. if the project has jpa and a database driver(connector) in the build file and there is not 'spring.datasource.url' in the application.properties. Then the CLI will start a TestContainers database and add temporary values to application.properties to allow the application to run successfully. That's if the driver is supported by the CLI and Docker is installed.  
Currently supported DBs are: MySQL, Postgres, and MariaDB.  

### format
Format the code using Spotless.
 
P.S. - New examples will be added soon!