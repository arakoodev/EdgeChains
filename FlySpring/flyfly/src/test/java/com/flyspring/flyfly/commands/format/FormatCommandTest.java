package com.flyspring.flyfly.commands.format;

import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import com.flyspring.flyfly.utils.ProjectTypeChecker;

@ExtendWith(MockitoExtension.class)
class FormatCommandTest {

  @Mock private Formatter formatter;

  @Mock private ProjectTypeChecker projectTypeChecker;

  @Autowired private FormatCommand formatCommand;

  @BeforeEach
  void setUp() {
    formatCommand = new FormatCommand();
    formatCommand.formatter = formatter;
    formatCommand.projectTypeChecker = projectTypeChecker;
  }

  @Test
  void testFormatWithGradleProject() {
    when(projectTypeChecker.isGradleProject()).thenReturn(true);
    formatCommand.run();
    verify(formatter, times(1)).format();
    verify(projectTypeChecker, times(1)).isGradleProject();
  }

  @Test
  void testFormatWithNoGradleProject() {
    when(projectTypeChecker.isGradleProject()).thenReturn(false);
    formatCommand.run();
    verify(formatter, times(0)).format();
    verify(projectTypeChecker, times(1)).isGradleProject();
  }
}
