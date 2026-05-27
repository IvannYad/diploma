using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using NewsConsole.Data.Entities;

namespace NewsConsole.Data;

public sealed class AppDbContext : IdentityDbContext<AppUser, IdentityRole<int>, int>
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<ProcessingServer> ProcessingServers => Set<ProcessingServer>();
    public DbSet<IntellectualProcessingProcess> IntellectualProcessingProcesses => Set<IntellectualProcessingProcess>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // Use cleaner table names instead of AspNet* defaults.
        builder.Entity<AppUser>().ToTable("Users");
        builder.Entity<IdentityRole<int>>().ToTable("Roles");
        builder.Entity<IdentityUserRole<int>>().ToTable("UserRoles");
        builder.Entity<IdentityUserClaim<int>>().ToTable("UserClaims");
        builder.Entity<IdentityUserLogin<int>>().ToTable("UserLogins");
        builder.Entity<IdentityRoleClaim<int>>().ToTable("RoleClaims");
        builder.Entity<IdentityUserToken<int>>().ToTable("UserTokens");

        builder.Entity<IntellectualProcessingProcess>(entity =>
        {
            entity.ToTable("IntellectualProcessingProcesses");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Id).ValueGeneratedNever();
            entity.Property(x => x.Type).IsRequired();
            entity.Property(x => x.ResultStatus).IsRequired();
            entity.Property(x => x.CreatedAt).IsRequired();
        });
    }
}
