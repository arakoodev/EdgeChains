package com.edgechain.lib.flyfly;

import com.edgechain.lib.flyfly.commands.jbang.JbangCommand;
import org.springframework.stereotype.Component;
import picocli.CommandLine.Command;

@Component
@Command(
    name = "edgechain",
    subcommands = {
      //      RunCommand.class,
      //      FormatCommand.class,
      JbangCommand.class,
      //      CommandLine.HelpCommand.class
    })
public class FlyflyCommand {}
