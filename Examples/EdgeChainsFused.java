import java.util.List;
import java.io.File;

public class EdgeChainsFused {
    public static void main(String[] args) throws Exception {
        File serviceLogsFile = new File("./service_logs.txt");
        File clientLogsFile = new File("./client_logs.txt");

        if (!serviceLogsFile.exists()) {
            serviceLogsFile.createNewFile();
        }

        if (!clientLogsFile.exists()) {
            clientLogsFile.createNewFile();
        }

        ProcessBuilder serviceProcess = new ProcessBuilder(List.of("java", "-jar", "flyfly.jar", "jbang",
                "EdgeChainServiceApplication.java", "edgechain-app-1.0.0.jar"));
        ProcessBuilder clientProcess = new ProcessBuilder(List.of("java", "-jar", "flyfly.jar", "jbang",
                "EdgeChainApplication.java", "edgechain-app-1.0.0.jar"));

        serviceProcess.redirectOutput(serviceLogsFile).start();
        clientProcess.redirectOutput(clientLogsFile).start();
    }
}
