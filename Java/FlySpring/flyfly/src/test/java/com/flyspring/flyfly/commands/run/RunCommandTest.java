package com.flyspring.flyfly.commands.run;

import static org.mockito.Mockito.*;
import java.io.File;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import com.flyspring.flyfly.utils.ProjectTypeChecker;

@ExtendWith(MockitoExtension.class)
class RunCommandTest {

  @Mock private JarRunner jarRunner;

  @Mock private ProjectRunner projectRunner;

  @Mock private ProjectTypeChecker projectTypeChecker;

  @Autowired private RunCommand runCommand;

  @BeforeEach
  void setUp() {
    runCommand = new RunCommand();
    runCommand.jarRunner = jarRunner;
    runCommand.projectRunner = projectRunner;
    runCommand.projectTypeChecker = projectTypeChecker;
  }

  @Test
  void testRunWithJarFile() {
    File[] jarFiles = {new File("test.jar")};
    runCommand.files = jarFiles;
    runCommand.run();
    verify(jarRunner, times(1)).run(jarFiles[0]);
    verify(projectRunner, times(0)).run();
    verify(projectTypeChecker, times(0)).isGradleProject();
  }

  @Test
  void testRunWithGradleProject() {
    File[] jarFiles = {};
    when(projectTypeChecker.isGradleProject()).thenReturn(true);
    runCommand.files = jarFiles;
    runCommand.run();
    verify(projectRunner, times(1)).run();
    verify(jarRunner, times(0)).run(any(File.class));
  }

  @Test
  void testRunWithNoJarFileAndNoGradleProject() {
    File[] jarFiles = {};
    when(projectTypeChecker.isGradleProject()).thenReturn(false);
    runCommand.files = jarFiles;
    runCommand.run();
    verify(projectRunner, times(0)).run();
    verify(jarRunner, times(0)).run(any(File.class));
  }
}
