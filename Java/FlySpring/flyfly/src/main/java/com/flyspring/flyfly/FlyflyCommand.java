package com.flyspring.flyfly;

import com.flyspring.flyfly.commands.jbang.JbangCommand;
import org.springframework.stereotype.Component;

import com.flyspring.flyfly.commands.format.FormatCommand;
import com.flyspring.flyfly.commands.run.RunCommand;

import picocli.CommandLine;
import picocli.CommandLine.Command;

@Component
@Command(
    name = "flyfly",
    subcommands = {
      RunCommand.class,
      FormatCommand.class,
      JbangCommand.class,
      CommandLine.HelpCommand.class
    })
public class FlyflyCommand {}
