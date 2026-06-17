# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY SistemaFinanceiro.Api.csproj ./
RUN dotnet restore "SistemaFinanceiro.Api.csproj"

COPY . ./
RUN dotnet publish "SistemaFinanceiro.Api.csproj" \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

COPY --from=build /app/publish ./

ENTRYPOINT ["dotnet", "SistemaFinanceiro.Api.dll"]
