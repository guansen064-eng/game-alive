FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /app
COPY pom.xml settings.xml ./
RUN mvn -s settings.xml -B -ntp dependency:go-offline
COPY src ./src
RUN mvn -s settings.xml -B -ntp clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine

WORKDIR /app
RUN addgroup -S spring \
    && adduser -S spring -G spring
COPY --from=build /app/target/alive-game-api.jar ./app.jar

EXPOSE 3000
USER spring
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
