import com.securegpt.PluginChecker;
import com.securegpt.PluginResult;

public class PluginCheckerUtil {
    public static void checkPlugins(String code) {
        // Initialize SecureGPT (replace with actual initialization code)
        PluginChecker.initialize();

        // Perform plugin check on the provided code
        PluginResult result = PluginChecker.check(code);

        // Process the plugin check result
        if (result.isSafe()) {
            System.out.println("The code is safe. No plugin issues found.");
        } else {
            System.out.println("The code contains potential plugin issues:");
            for (String issue : result.getIssues()) {
                System.out.println(issue);
            }
        }
    }
}
