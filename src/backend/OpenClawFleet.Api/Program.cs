using Microsoft.EntityFrameworkCore;
using OpenClawFleet.Infrastructure.Data;
using OpenClawFleet.Infrastructure.Docker;
using OpenClawFleet.Infrastructure.Ollama;
using OpenClawFleet.Core.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure PostgreSQL
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Host=localhost;Database=openclaw_fleet;Username=openclaw;Password=openclaw_secret";

builder.Services.AddDbContext<FleetDbContext>(options =>
    options.UseNpgsql(connectionString));

// Register services
builder.Services.AddSingleton<IDockerService, DockerService>();
builder.Services.AddSingleton<IOllamaService>(sp => 
    new OllamaService(
        sp.GetRequiredService<ILogger<OllamaService>>(),
        builder.Configuration["Ollama:BaseUrl"] ?? "http://localhost:11434"
    ));

// Add CORS for Angular frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://localhost:8080")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Add SignalR for real-time updates
builder.Services.AddSignalR();

// Add Keycloak authentication (to be configured)
builder.Services.AddAuthentication("Bearer")
    .AddJwtBearer("Bearer", options =>
    {
        options.Authority = builder.Configuration["Keycloak:Authority"] 
            ?? "http://localhost:8080/realms/openclaw-fleet";
        options.Audience = builder.Configuration["Keycloak:Audience"] 
            ?? "openclaw-fleet-api";
        options.RequireHttpsMetadata = false;
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Ensure database is created and migrations applied
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<FleetDbContext>();
    dbContext.Database.EnsureCreated();
}

app.UseHttpsRedirection();
app.UseCors("AllowAngular");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<FleetHub>("/hubs/fleet");

app.Run();

// Make Program class accessible for testing
public partial class Program { }