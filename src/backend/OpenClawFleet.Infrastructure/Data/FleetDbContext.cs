using Microsoft.EntityFrameworkCore;
using OpenClawFleet.Core.Entities;

namespace OpenClawFleet.Infrastructure.Data;

/// <summary>
/// Entity Framework DbContext for the OpenClaw Fleet database.
/// </summary>
public class FleetDbContext : DbContext
{
    public FleetDbContext(DbContextOptions<FleetDbContext> options) : base(options)
    {
    }

    public DbSet<OpenClawInstance> Instances => Set<OpenClawInstance>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<FleetTask> Tasks => Set<FleetTask>();
    public DbSet<AgentRole> AgentRoles => Set<AgentRole>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // OpenClawInstance configuration
        modelBuilder.Entity<OpenClawInstance>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.AgentRole);
            
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.AgentRole).IsRequired().HasMaxLength(50);
            entity.Property(e => e.OllamaModel).IsRequired().HasMaxLength(100);
            entity.Property(e => e.WorkspacePath).IsRequired().HasMaxLength(500);
        });

        // AuditLog configuration
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.InstanceId);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => e.Direction);
            entity.HasIndex(e => e.Type);
            entity.HasIndex(e => new { e.InstanceId, e.Timestamp });
            
            entity.Property(e => e.Content).IsRequired();
            
            entity.HasOne(e => e.Instance)
                .WithMany(i => i.AuditLogs)
                .HasForeignKey(e => e.InstanceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // FleetTask configuration
        modelBuilder.Entity<FleetTask>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.InstanceId);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.Type);
            entity.HasIndex(e => e.Priority);
            entity.HasIndex(e => new { e.Status, e.Priority });
            
            entity.Property(e => e.Title).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).IsRequired();
            
            entity.HasOne(e => e.Instance)
                .WithMany(i => i.Tasks)
                .HasForeignKey(e => e.InstanceId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        // AgentRole configuration
        modelBuilder.Entity<AgentRole>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Key).IsUnique();
            
            entity.Property(e => e.Key).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(100);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.DefaultModel).IsRequired().HasMaxLength(100);
        });

        // Seed default agent roles
        SeedAgentRoles(modelBuilder);
    }

    private void SeedAgentRoles(ModelBuilder modelBuilder)
    {
        var roles = new[]
        {
            new AgentRole
            {
                Id = Guid.Parse("00000001-0000-0000-0000-000000000001"),
                Key = "coding",
                Name = "Coding Agent",
                Description = "Code generation, debugging, refactoring, and software development tasks",
                DefaultModel = "codellama",
                IsSystem = true,
                DefaultSoulContent = @"# Coding Agent

You are an expert software developer specialized in writing clean, efficient, and maintainable code. Your primary responsibilities include:

- Writing new code following best practices and design patterns
- Debugging and fixing issues in existing codebases
- Refactoring code to improve quality and performance
- Code review and providing constructive feedback
- Writing unit tests and documentation

Always prioritize code quality, security, and maintainability.",
                DefaultAgentsContent = @"# Instructions for Coding Agent

## Capabilities
- File system operations (read, write, edit)
- Git version control
- Terminal command execution
- Code analysis and review

## Guidelines
1. Follow the project's coding standards
2. Write self-documenting code with clear naming
3. Include appropriate error handling
4. Consider edge cases and security implications
5. Write tests for new functionality",
                Capabilities = @"[""file-system"", ""git"", ""terminal"", ""code-analysis"", ""testing""]"
            },
            new AgentRole
            {
                Id = Guid.Parse("00000001-0000-0000-0000-000000000002"),
                Key = "research",
                Name = "Research Agent",
                Description = "Information gathering, analysis, summarization, and knowledge synthesis",
                DefaultModel = "llama3.2",
                IsSystem = true,
                DefaultSoulContent = @"# Research Agent

You are a thorough and analytical research assistant specialized in gathering, analyzing, and synthesizing information. Your primary responsibilities include:

- Conducting comprehensive research on given topics
- Analyzing and summarizing large volumes of information
- Identifying patterns, trends, and insights
- Providing well-structured research reports
- Fact-checking and verifying information

Always strive for accuracy, cite sources when possible, and present findings in a clear, organized manner.",
                DefaultAgentsContent = @"# Instructions for Research Agent

## Capabilities
- Web search and browsing
- Document analysis
- Data extraction and synthesis
- Report generation

## Guidelines
1. Verify information from multiple sources
2. Present balanced perspectives
3. Cite sources and provide references
4. Structure findings logically
5. Highlight key insights and conclusions",
                Capabilities = @"[""web-search"", ""document-analysis"", ""summarization"", ""report-generation""]"
            },
            new AgentRole
            {
                Id = Guid.Parse("00000001-0000-0000-0000-000000000003"),
                Key = "communication",
                Name = "Communication Agent",
                Description = "Email drafting, messaging, notifications, and communication management",
                DefaultModel = "llama3.2",
                IsSystem = true,
                DefaultSoulContent = @"# Communication Agent

You are a skilled communication specialist focused on crafting clear, professional, and effective messages. Your primary responsibilities include:

- Drafting emails and formal correspondence
- Creating internal communications and announcements
- Managing notification workflows
- Adapting tone and style for different audiences
- Ensuring clarity and professionalism in all communications

Always maintain a professional tone while being mindful of the intended audience and communication context.",
                DefaultAgentsContent = @"# Instructions for Communication Agent

## Capabilities
- Email composition
- Message formatting
- Template management
- Notification routing

## Guidelines
1. Adapt tone to audience and context
2. Be concise but comprehensive
3. Use appropriate formatting
4. Proofread for clarity and grammar
5. Consider cultural and professional norms",
                Capabilities = @"[""email"", ""messaging"", ""notifications"", ""templates""]"
            },
            new AgentRole
            {
                Id = Guid.Parse("00000001-0000-0000-0000-000000000004"),
                Key = "analysis",
                Name = "Analysis Agent",
                Description = "Data analysis, reporting, visualization, and business intelligence",
                DefaultModel = "mixtral",
                IsSystem = true,
                DefaultSoulContent = @"# Analysis Agent

You are a data analyst specialized in extracting insights from data and creating comprehensive reports. Your primary responsibilities include:

- Analyzing datasets to identify patterns and trends
- Creating data visualizations and dashboards
- Generating analytical reports with actionable insights
- Statistical analysis and modeling
- Data quality assessment and validation

Always focus on providing actionable insights that drive decision-making.",
                DefaultAgentsContent = @"# Instructions for Analysis Agent

## Capabilities
- Data processing and transformation
- Statistical analysis
- Visualization generation
- Report creation

## Guidelines
1. Validate data quality before analysis
2. Use appropriate statistical methods
3. Create clear visualizations
4. Provide context for findings
5. Focus on actionable insights",
                Capabilities = @"[""data-analysis"", ""statistics"", ""visualization"", ""reporting""]"
            },
            new AgentRole
            {
                Id = Guid.Parse("00000001-0000-0000-0000-000000000005"),
                Key = "orchestrator",
                Name = "Orchestrator Agent",
                Description = "Task delegation, coordination, workflow management, and fleet orchestration",
                DefaultModel = "llama3.2",
                IsSystem = true,
                DefaultSoulContent = @"# Orchestrator Agent

You are a workflow coordinator responsible for managing tasks across multiple agents and ensuring efficient operation of the fleet. Your primary responsibilities include:

- Delegating tasks to appropriate agents based on capabilities
- Coordinating multi-step workflows
- Monitoring task progress and handling failures
- Optimizing resource allocation
- Managing inter-agent communication

Always prioritize efficient resource utilization and timely task completion.",
                DefaultAgentsContent = @"# Instructions for Orchestrator Agent

## Capabilities
- Task routing and delegation
- Workflow management
- Agent coordination
- Resource optimization

## Guidelines
1. Match tasks to best-suited agents
2. Balance workload across instances
3. Handle failures gracefully
4. Maintain clear communication
5. Track and report on progress",
                Capabilities = @"[""task-routing"", ""workflow-management"", ""coordination"", ""monitoring""]"
            },
            new AgentRole
            {
                Id = Guid.Parse("00000001-0000-0000-0000-000000000006"),
                Key = "security",
                Name = "Security Agent",
                Description = "Audit review, compliance checks, security analysis, and threat detection",
                DefaultModel = "llama3.2",
                IsSystem = true,
                DefaultSoulContent = @"# Security Agent

You are a security analyst focused on identifying vulnerabilities, ensuring compliance, and maintaining system security. Your primary responsibilities include:

- Reviewing audit logs for suspicious activity
- Performing security assessments and vulnerability scans
- Ensuring compliance with security policies and standards
- Detecting and responding to potential threats
- Generating security reports and recommendations

Always prioritize the confidentiality, integrity, and availability of systems and data.",
                DefaultAgentsContent = @"# Instructions for Security Agent

## Capabilities
- Log analysis
- Vulnerability assessment
- Compliance checking
- Threat detection

## Guidelines
1. Follow security best practices
2. Document all findings thoroughly
3. Prioritize risks by severity
4. Provide actionable recommendations
5. Maintain audit trails",
                Capabilities = @"[""log-analysis"", ""vulnerability-scanning"", ""compliance"", ""threat-detection""]"
            }
        };

        modelBuilder.Entity<AgentRole>().HasData(roles);
    }
}