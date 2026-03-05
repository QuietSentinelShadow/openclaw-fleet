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

// Configure SQLite database
builder.Services.AddDbContext<FleetDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection") 
        ?? "Data Source=openclaw_fleet.db"));

// Register services
builder.Services.AddScoped<IDockerService, DockerService>();
builder.Services.AddScoped<IOllamaService, OllamaService>();

// Configure CORS for Angular frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Configure SignalR
builder.Services.AddSignalR();

var app = builder.Build();

// Ensure database is created
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<FleetDbContext>();
    db.Database.EnsureCreated();
    
    // Seed default agent roles
    if (!db.AgentRoles.Any())
    {
        db.AgentRoles.AddRange(
            new OpenClawFleet.Core.Entities.AgentRole
            {
                Id = Guid.NewGuid(),
                Key = "code-helper",
                Name = "Code Helper",
                Description = "General coding assistance and debugging",
                DefaultModel = "llama3.2",
                DefaultSoulContent = "You are a helpful coding assistant specialized in writing clean, efficient code.",
                DefaultAgentsContent = "Focus on providing code solutions with explanations.",
                IsSystem = true,
                IsActive = true
            },
            new OpenClawFleet.Core.Entities.AgentRole
            {
                Id = Guid.NewGuid(),
                Key = "code-reviewer",
                Name = "Code Reviewer",
                Description = "Code review and quality analysis",
                DefaultModel = "codellama",
                DefaultSoulContent = "You are an expert code reviewer focused on code quality, security, and best practices.",
                DefaultAgentsContent = "Analyze code for bugs, security issues, and improvements.",
                IsSystem = true,
                IsActive = true
            },
            new OpenClawFleet.Core.Entities.AgentRole
            {
                Id = Guid.NewGuid(),
                Key = "research-assistant",
                Name = "Research Assistant",
                Description = "Research and information gathering",
                DefaultModel = "mistral",
                DefaultSoulContent = "You are a research assistant skilled at finding and synthesizing information.",
                DefaultAgentsContent = "Provide thorough research with citations when possible.",
                IsSystem = true,
                IsActive = true
            },
            new OpenClawFleet.Core.Entities.AgentRole
            {
                Id = Guid.NewGuid(),
                Key = "task-orchestrator",
                Name = "Task Orchestrator",
                Description = "Multi-agent task coordination",
                DefaultModel = "llama3.2",
                DefaultSoulContent = "You are a task orchestrator that coordinates work between multiple agents.",
                DefaultAgentsContent = "Break down complex tasks and coordinate agent collaboration.",
                IsSystem = true,
                IsActive = true
            }
        );
        db.SaveChanges();
    }
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAngular");
app.UseAuthorization();
app.MapControllers();
app.MapHub<OpenClawFleet.Api.Hubs.FleetHub>("/hubs/fleet");

app.Run();